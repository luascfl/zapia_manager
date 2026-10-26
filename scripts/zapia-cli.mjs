#!/usr/bin/env node
// Zapia CLI: list, read and send messages through an already logged-in Zapia tab.
//
// It attaches to Chrome over CDP, runs every API call inside the page (so the session token
// never leaves the browser). A send opens the thread by its route, types into the composer and
// presses a trusted Enter key. No screen coordinates are used, and every send is confirmed
// through the API afterwards.
//
//   node scripts/zapia-cli.mjs list [--limit 50]
//   node scripts/zapia-cli.mjs read <thread> [--limit 20]
//   node scripts/zapia-cli.mjs send <thread|--new> <text> [--wait SECONDS]
//
// <thread> is a thread id, an exact title, or a unique part of a title.
import { pathToFileURL } from 'node:url';

const ENDPOINT = process.env.CDP_URL ?? 'http://127.0.0.1:9222';
const ORIGIN = 'https://app.zapia.com';
// Zapia's composer is a Flutter-managed textarea; its accessible name follows the UI language.
const COMPOSER_LABEL = process.env.ZAPIA_COMPOSER_LABEL ?? 'Pergunte-me qualquer coisa';
const SESSION_PARAMS = ['contact_number', 'device_id', 'user_email', 'auth_token'];

export class CliError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    this.extra = extra;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(description, probe, { timeout = 30000, interval = 500 } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new CliError('timeout', `Timed out waiting for ${description}.`);
    await sleep(interval);
  }
}

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--new') flags.new = true;
    else if (arg === '--limit' || arg === '--wait' || arg === '--target') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new CliError('usage', `${arg} needs a value.`);
      flags[arg.slice(2)] = value;
      i += 1;
    } else if (arg.startsWith('--')) throw new CliError('usage', `Unknown flag ${arg}.`);
    else positional.push(arg);
  }
  return { positional, flags };
}

function positiveInt(value, fallback, name) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new CliError('usage', `${name} must be a positive integer.`);
  return number;
}

// Resolve a user query to exactly one thread: id, exact title, then unique title fragment.
export function resolveThread(threads, query) {
  const text = String(query ?? '').trim();
  if (!text) throw new CliError('usage', 'A thread id or title is required.');
  const byId = threads.filter((thread) => thread.id === text);
  if (byId.length === 1) return byId[0];
  const lower = text.toLowerCase();
  for (const matches of [
    threads.filter((thread) => thread.label === text),
    threads.filter((thread) => (thread.label ?? '').toLowerCase() === lower),
    threads.filter((thread) => (thread.label ?? '').toLowerCase().includes(lower)),
  ]) {
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new CliError('ambiguous_thread', `"${text}" matches ${matches.length} threads. Use the thread id.`, {
        candidates: matches.slice(0, 10).map((thread) => ({ id: thread.id, label: thread.label })),
      });
    }
  }
  throw new CliError('thread_not_found', `No thread matches "${text}".`);
}

class Page {
  constructor(socket) {
    this.socket = socket;
    this.sequence = 0;
    this.pending = new Map();
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      const waiter = message.id && this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    });
    socket.addEventListener('close', () => {
      for (const waiter of this.pending.values()) waiter.reject(new Error('CDP connection closed.'));
      this.pending.clear();
    });
  }

  send(method, params = {}) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      throw new CliError('page_error', result.exceptionDetails.exception?.description ?? 'Page evaluation failed.');
    }
    return result.result.value;
  }

  close() {
    this.socket.close();
  }
}

async function attach(targetId) {
  let targets;
  try {
    targets = await fetch(`${ENDPOINT}/json/list`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json());
  } catch {
    throw new CliError('no_browser', `Chrome is not reachable at ${ENDPOINT}. Start it with --remote-debugging-port=9222.`);
  }
  const tabs = targets.filter((t) => t.type === 'page' && t.url.startsWith(`${ORIGIN}/`) && (!targetId || t.id === targetId));
  if (tabs.length > 1) throw new CliError('ambiguous_tab', `Found ${tabs.length} Zapia tabs. Choose one with --target.`);
  let target = tabs[0];
  if (!target) {
    target = await fetch(`${ENDPOINT}/json/new?${ORIGIN}/chat`, { method: 'PUT' }).then((r) => r.json());
  }
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new CliError('no_browser', 'Could not open the tab socket.')), { once: true });
  });
  return new Page(socket);
}

// Code that runs inside the page. The session parameters are read from the page's own
// requests and never returned to the caller.
const PAGE_API = `
const SESSION_PARAMS = ${JSON.stringify(SESSION_PARAMS)};
const sessionEntry = () => performance.getEntriesByType('resource').reverse()
  .find((e) => e.name.includes('/api/v1/threads') && e.name.includes('auth_token='));
const apiUrl = (path, query = {}) => {
  const entry = sessionEntry();
  if (!entry) return null;
  const source = new URL(entry.name);
  const url = new URL(path, source.origin);
  for (const name of SESSION_PARAMS) url.searchParams.set(name, source.searchParams.get(name));
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  return url;
};
const apiGet = async (path, query) => {
  const url = apiUrl(path, query);
  if (!url) return { status: 0 };
  const response = await fetch(url);
  return { status: response.status, body: response.ok ? await response.json() : null };
};
`;

async function api(page, path, query = {}) {
  const result = await page.evaluate(`(async () => { ${PAGE_API}
    return await apiGet(${JSON.stringify(path)}, ${JSON.stringify(query)}); })()`);
  if (result.status === 0) {
    throw new CliError('no_session', 'The tab has made no authenticated Zapia request yet. Reload the tab and try again.');
  }
  if (result.status === 401 || result.status === 403) {
    throw new CliError('session_rejected', 'Zapia rejected the session. Open any chat once, or sign in again.');
  }
  if (result.status !== 200) throw new CliError('api_error', `Zapia answered HTTP ${result.status}.`);
  return result.body;
}

async function ready(page) {
  await until('the Zapia UI', () => page.evaluate(`!!document.querySelector('textarea')`), { timeout: 60000 });
  await until('an authenticated Zapia request', () => page.evaluate(`(() => { ${PAGE_API} return !!sessionEntry(); })()`), { timeout: 60000 });
  if (await page.evaluate(`document.querySelectorAll('flt-semantics').length === 0`)) {
    // Flutter builds its labelled DOM tree (including the composer) only after its accessibility placeholder is activated.
    await page.evaluate(`document.querySelector('flt-semantics-placeholder')?.click()`);
    await until('the semantics tree', () => page.evaluate(`document.querySelectorAll('flt-semantics').length > 0`), { timeout: 15000 });
  }
}

async function listThreads(page, limit) {
  const seen = new Map();
  let before;
  for (let round = 0; round < 20 && seen.size < limit; round += 1) {
    const body = await api(page, '/api/v1/threads', { limit: String(Math.min(50, limit)), ...(before ? { before } : {}) });
    for (const thread of [...(body.threads_pinned ?? []), ...(body.threads ?? [])]) {
      if (!seen.has(thread.id)) seen.set(thread.id, thread);
    }
    if (!body.has_more || !body.next_cursor) break;
    before = body.next_cursor;
  }
  return [...seen.values()].slice(0, limit).map((t) => ({
    id: t.id,
    label: t.label,
    unread: t.unread_count,
    last_activity_at: t.last_activity_at,
    pinned: Boolean(t.pinned_at),
  }));
}

async function readMessages(page, id, limit) {
  const messages = [];
  let before;
  while (messages.length < limit) {
    const body = await api(page, `/api/v1/threads/${encodeURI(id)}/messages`, {
      limit: String(Math.min(100, limit - messages.length)),
      ...(before ? { before } : {}),
    });
    const batch = body.messages ?? [];
    messages.push(...batch);
    if (!body.has_more || !body.next_cursor || batch.length === 0) break;
    before = body.next_cursor;
  }
  return messages
    .map((m) => ({ role: m.role, content: m.content, created_at: m.created_at }))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

async function typeAndSend(page, text) {
  const composer = `document.querySelector('textarea[aria-label=${JSON.stringify(COMPOSER_LABEL)}]')`;
  await until('the message composer', () => page.evaluate(`(() => { const c = ${composer}; return !!c && c.getBoundingClientRect().width > 0; })()`), { timeout: 15000 });
  await page.evaluate(`${composer}.focus()`);
  await page.send('Input.insertText', { text });
  // A trusted Enter key press sends the message. It is never retried: a send may already have taken effect.
  for (const type of ['keyDown', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', {
      type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, ...(type === 'keyDown' ? { text: '\r' } : {}),
    });
  }
}

// Open a Zapia route and wait until the app has booted and made an authenticated request.
async function openRoute(page, route) {
  await page.evaluate('window.__zapiaCliStale = true');
  await page.send('Page.navigate', { url: `${ORIGIN}${route}` });
  await until('the route to load', async () => {
    try {
      return await page.evaluate('window.__zapiaCliStale === undefined && document.readyState === "complete"');
    } catch {
      return false; // The execution context is gone while the document is replaced.
    }
  }, { timeout: 30000 });
  await ready(page);
  return decodeURIComponent(await page.evaluate('location.href'));
}

async function send(page, query, text, waitSeconds) {
  const known = await listThreads(page, 200);
  const knownIds = new Set(known.map((t) => t.id));
  let thread = null;

  if (query === null) {
    const href = await openRoute(page, '/chat');
    if (known.some((t) => href.includes(`pulsusNumber=${t.id}`))) {
      throw new CliError('new_chat_not_blank', 'Zapia reopened an existing thread instead of a blank chat. Nothing was sent.');
    }
  } else {
    thread = resolveThread(known, query);
    // The route carries the thread id, so selection never depends on sidebar titles.
    const href = await openRoute(page, `/chat?pulsusNumber=${thread.id}`);
    if (!href.includes(`pulsusNumber=${thread.id}`)) {
      throw new CliError('thread_not_opened', `Zapia did not open "${thread.label}". Nothing was sent.`);
    }
  }

  await typeAndSend(page, text);

  const locate = async () => {
    if (thread) return thread;
    const fresh = (await listThreads(page, 20)).filter((t) => !knownIds.has(t.id));
    return fresh.length === 1 ? fresh[0] : null;
  };
  let sent = null;
  try {
    sent = await until('the sent message to appear', async () => {
      const target = await locate();
      if (!target) return null;
      const messages = await readMessages(page, target.id, 10);
      const match = [...messages].reverse().find((m) => m.role === 'user' && m.content === text);
      return match ? { thread: target, message: match } : null;
    }, { timeout: 30000, interval: 1500 });
  } catch {
    throw new CliError('send_unconfirmed', 'The message was typed and Enter was pressed, but the API did not confirm it. Check the tab before retrying: a retry could duplicate it.');
  }

  const result = { thread: { id: sent.thread.id, label: sent.thread.label }, sent_at: sent.message.created_at };
  if (waitSeconds) result.reply = await waitForReply(page, sent.thread.id, sent.message.created_at, waitSeconds);
  return result;
}

// A reply is complete when the newest assistant message is unchanged across two polls.
async function waitForReply(page, id, after, seconds) {
  const deadline = Date.now() + seconds * 1000;
  let previous = null;
  while (Date.now() < deadline) {
    const messages = await readMessages(page, id, 20);
    const reply = [...messages].reverse().find((m) => m.role === 'assistant' && String(m.created_at) > String(after));
    if (reply && previous === reply.content) return reply;
    previous = reply?.content ?? null;
    await sleep(3000);
  }
  return null;
}

async function main(argv) {
  const [command, ...rest] = argv;
  const { positional, flags } = parseArgs(rest);
  if (!['list', 'read', 'send'].includes(command)) {
    throw new CliError('usage', 'Usage: zapia-cli.mjs list | read <thread> | send <thread|--new> <text> [--wait SECONDS]');
  }
  const page = await attach(flags.target);
  try {
    await ready(page);
    if (command === 'list') return await listThreads(page, positiveInt(flags.limit, 50, '--limit'));
    if (command === 'read') {
      const thread = resolveThread(await listThreads(page, 200), positional[0]);
      return { thread: { id: thread.id, label: thread.label }, messages: await readMessages(page, thread.id, positiveInt(flags.limit, 20, '--limit')) };
    }
    const text = flags.new ? positional[0] : positional[1];
    if (!text) throw new CliError('usage', 'send needs a message text.');
    if (!flags.new && !positional[0]) throw new CliError('usage', 'send needs a thread or --new.');
    return await send(page, flags.new ? null : positional[0], text, flags.wait ? positiveInt(flags.wait, 0, '--wait') : 0);
  } finally {
    page.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (result) => { console.log(JSON.stringify(result, null, 2)); },
    (error) => {
      console.error(JSON.stringify({ error: error.code ?? 'error', message: error.message, ...(error.extra ?? {}) }, null, 2));
      process.exitCode = error instanceof CliError && error.code === 'usage' ? 2 : 1;
    },
  );
}

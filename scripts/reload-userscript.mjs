import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Development-only: replace the userscript in one existing, authenticated tab.
const args = process.argv.slice(2);
const migrate = args.includes('--migrate');
const targetIndex = args.indexOf('--target');
const targetId = targetIndex < 0 ? null : args[targetIndex + 1];
if (args.some((arg, i) => arg !== '--migrate' && arg !== '--target' && !(targetIndex >= 0 && i === targetIndex + 1))
  || (targetIndex >= 0 && !targetId)) {
  throw new Error('Usage: node scripts/reload-userscript.mjs [--target CDP_TARGET_ID] [--migrate]');
}
const sourcePath = fileURLToPath(new URL('../zapia-manager.user.js', import.meta.url));
const check = spawnSync(process.execPath, ['--check', sourcePath], { encoding: 'utf8' });
if (check.status !== 0) throw new Error(check.stderr || 'Userscript syntax check failed.');
const source = await readFile(sourcePath, 'utf8');
const endpoint = 'http://127.0.0.1:9222';
const targets = await fetch(`${endpoint}/json/list`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json());
const matches = targets.filter((target) => {
  if (target.type !== 'page' || (targetId && target.id !== targetId)) return false;
  const url = new URL(target.url);
  return url.origin === 'https://app.zapia.com' && url.pathname.startsWith('/chat');
});
if (matches.length !== 1) {
  throw new Error(`Expected one Zapia tab, found ${matches.length}. Choose its exact CDP id with --target.`);
}
const target = matches[0];
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', ({ data }) => {
  const result = JSON.parse(data);
  const task = pending.get(result.id);
  if (!task) return;
  pending.delete(result.id);
  clearTimeout(task.timer);
  if (result.error) task.reject(new Error(result.error.message));
  else task.resolve(result.result);
});
socket.addEventListener('close', () => {
  for (const task of pending.values()) {
    clearTimeout(task.timer);
    task.reject(new Error('CDP tab disconnected.'));
  }
  pending.clear();
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timed out: ${method}`));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value;
}
async function waitForState(expression, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const result = await evaluate(expression);
      if (result) return result;
    } catch (error) {
      if (!/context|navigation|document is not defined/i.test(error.message)) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Zapia did not reach the expected page state.');
}
const started = performance.now();
try {
  const before = await evaluate(`({
    origin: performance.timeOrigin,
    runtime: Boolean(window.__zapiaManager),
    status: window.__zapiaManager?.status(),
    legacy: Boolean(document.querySelector('[data-zapia-manager-panel]'))
      || [...document.querySelectorAll('style')].some((s) => s.textContent.includes('.zapia-manager-panel')),
  })`);
  if (before.status?.acting) throw new Error('Wait for the active native chat action to finish.');
  if (before.legacy && !before.runtime) {
    if (!migrate) {
      throw new Error('Legacy userscript has no cleanup hook. Run once with --migrate to preserve its catalogue through a single page reload. Later runs never reload Zapia.');
    }
    await evaluate(`(() => {
      const panel = document.querySelector('[data-zapia-manager-panel]');
      const chats = [...document.querySelectorAll('.zapia-manager-chat-option')].map((row) => ({
        id: 'text:' + row.querySelector('span').textContent,
        title: row.querySelector('span').textContent,
      }));
      if (panel?.textContent.includes('carregando…')) throw new Error('Wait for the legacy scan to finish.');
      sessionStorage.setItem('zapia_manager_dev_snapshot', JSON.stringify({
        chats,
        selection: [...document.querySelectorAll('.zapia-manager-chat-option input:checked')]
          .map((input) => 'text:' + input.closest('label').querySelector('span').textContent),
        filters: [],
        complete: chats.length > 0,
        collapsed: panel?.classList.contains('is-collapsed') ?? false,
        listScroll: document.querySelector('.zapia-manager-chat-list')?.scrollTop ?? 0,
      }));
    })()`);
    await send('Page.reload');
    await waitForState(`document.querySelector('flutter-view') && document.readyState !== 'loading'`);
  }
  await evaluate(source);
  await waitForState(`document.querySelector('[data-zapia-manager-panel]')`);
  const after = await evaluate(`({
    origin: performance.timeOrigin,
    version: window.__zapiaManager.version,
    status: window.__zapiaManager.status(),
    panels: document.querySelectorAll('[data-zapia-manager-panel]').length,
    styles: document.querySelectorAll('[data-zapia-manager-style]').length,
  })`);
  console.log(JSON.stringify({
    target: target.id,
    version: after.version,
    elapsedMs: Math.round(performance.now() - started),
    documentReloaded: before.origin !== after.origin,
    ...after.status,
    panels: after.panels,
    styles: after.styles,
  }, null, 2));
} finally {
  socket.close();
}

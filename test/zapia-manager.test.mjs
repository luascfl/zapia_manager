import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const manager = require('../zapia-manager.user.js');

test('managed prefixes are idempotent and mutually exclusive', () => {
  assert.equal(manager.withPrefix('Alice', '✔ '), '✔ Alice');
  assert.equal(manager.withPrefix('✔ Alice', '✔ '), '✔ Alice');
  assert.equal(manager.withPrefix('✔ Alice', '🟡 '), '🟡 Alice');
  assert.equal(manager.withPrefix('🟡   Alice', '✔ '), '✔ Alice');
  assert.equal(manager.stripManagedPrefix('🟡 Alice'), 'Alice');
});

test('only configured labels are accepted', () => {
  assert.throws(() => manager.withPrefix('Alice', '🔴 '), /Unsupported Zapia label/);
});

test('a delete candidate is safe only in a native menu', () => {
  assert.equal(manager.canActivateDeleteCandidate({ containerRole: 'menu', label: 'Excluir chat' }), true);
  assert.equal(manager.canActivateDeleteCandidate({ containerRole: 'menu', label: 'Delete conversation' }), true);
  assert.equal(manager.canActivateDeleteCandidate({ containerRole: 'dialog', label: 'Excluir chat' }), false);
  assert.equal(manager.canActivateDeleteCandidate({ containerRole: 'menu', label: 'Salvar' }), false);
});

test('current-chat shortcuts accept both Alt and Alt+Shift chords while rejecting unmodified or browser keys', () => {
  assert.equal(manager.currentChatShortcut({ altKey: true, shiftKey: false, ctrlKey: false, metaKey: false, repeat: false, code: 'KeyC' }), 'prefix-check');
  assert.equal(manager.currentChatShortcut({ altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, repeat: false, code: 'KeyC' }), 'prefix-check');
  assert.equal(manager.currentChatShortcut({ altKey: true, shiftKey: false, ctrlKey: false, metaKey: false, repeat: false, code: 'KeyY' }), 'prefix-yellow');
  assert.equal(manager.currentChatShortcut({ altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, repeat: false, code: 'KeyY' }), 'prefix-yellow');
  assert.equal(manager.currentChatShortcut({ altKey: true, shiftKey: false, ctrlKey: false, metaKey: false, repeat: false, code: 'KeyX' }), 'delete');
  assert.equal(manager.currentChatShortcut({ altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, repeat: false, code: 'KeyX' }), 'delete');
  assert.equal(manager.currentChatShortcut({ altKey: false, shiftKey: false, ctrlKey: true, metaKey: false, repeat: false, code: 'KeyC' }), null);
  assert.equal(manager.currentChatShortcut({ altKey: true, shiftKey: false, ctrlKey: false, metaKey: false, repeat: true, code: 'KeyX' }), null);
});

test('shortcut configuration parses only modified supported keys', () => {
  assert.deepEqual(manager.parseShortcut('Alt+Shift+Y'), { ctrlKey: false, altKey: true, shiftKey: true, metaKey: false, code: 'KeyY' });
  assert.equal(manager.parseShortcut('Y'), null);
  assert.equal(manager.parseShortcut('Alt+Shift+Escape'), null);
});

test('reserved browser shortcuts are rejected while custom chords are accepted', () => {
  for (const chord of ['Alt+F4', 'Ctrl+W']) {
    assert.ok(manager.shortcutValidationError(manager.parseShortcut(chord)));
  }
  assert.equal(manager.shortcutValidationError(manager.parseShortcut('Alt+Shift+C')), null);
  assert.equal(manager.shortcutValidationError(manager.parseShortcut('Alt+C')), null);
});

test('native menu actions match only their exact label, never link text', () => {
  assert.equal(manager.MENU_RENAME_ACTION.test('Renomear'), true);
  assert.equal(manager.MENU_DELETE_ACTION.test('Excluir'), true);
  assert.equal(manager.MENU_RENAME_ACTION.test('Edital do programa Mais Futuro'), false);
  assert.equal(manager.MENU_RENAME_ACTION.test('docs.google.com/document/d/abc/edit'), false);
  assert.equal(manager.MENU_DELETE_ACTION.test('Como remover ou excluir inscrição'), false);
});

test('the Zapia Pro promo banner is navigation, not a chat row', () => {
  assert.equal(manager.isNavigationActionLabel('Ganhe o Zapia Pro de graça'), true);
  assert.equal(manager.isNavigationActionLabel('Ganhe o Zapia Pro de graça Nova função disponível'), true);
  assert.equal(manager.isNavigationActionLabel('Ganhe tempo com o Zapia Pro'), false);
});

test('sidebar catalogue fits between native navigation and profile', () => {
  const nav = { left: 0, right: 280, top: 0, bottom: 768, width: 280 };
  assert.deepEqual(manager.sidebarPlacement(nav, 286, 708, 1366, 768), {
    left: 0, top: 286, width: 280, height: 422, right: 280, bottom: 708,
  });
  assert.equal(manager.sidebarPlacement(nav, null, 708, 1366, 768), null);
  assert.equal(manager.sidebarPlacement(nav, 286, 200, 1366, 768), null);
});

test('offscreen or closing native drawers never leave a floating catalogue', () => {
  assert.equal(manager.sidebarPlacement({ left: -280, right: 0, top: 0, bottom: 768, width: 280 }, 286, 708, 1366, 768), null);
  assert.equal(manager.sidebarPlacement({ left: 0, right: 280, top: 0, bottom: 768, width: 280 }, 286, 708, 240, 768), null);
});

test('native menus hide the catalogue only when their rectangles actually overlap', () => {
  const sidebar = { left: 0, right: 280, top: 286, bottom: 708 };
  assert.equal(manager.rectanglesOverlap(sidebar, { left: 1100, right: 1320, top: 60, bottom: 260 }), false);
  assert.equal(manager.rectanglesOverlap(sidebar, { left: 180, right: 380, top: 300, bottom: 450 }), true);
  assert.equal(manager.rectanglesOverlap(sidebar, { left: 280, right: 480, top: 300, bottom: 450 }), false);
});

const prefixes = ['✔', '🟡'];

test('filters match [number] ids and the two configured emojis, tolerating ✔️ and a missing space', () => {
  assert.equal(manager.chatMatchesFilter('[2] Capítulo de Larissa', 'numbered', prefixes), true);
  assert.equal(manager.chatMatchesFilter('✔ [4] Programa', 'numbered', prefixes), true);
  assert.equal(manager.chatMatchesFilter('Resumo [3] solto', 'numbered', prefixes), false);
  assert.equal(manager.chatMatchesFilter('✔️ Caso Mourad', 'prefix-0', prefixes), true);
  assert.equal(manager.chatMatchesFilter('✔Rascunho', 'prefix-0', prefixes), true);
  assert.equal(manager.chatMatchesFilter('🟡 ObtainX', 'prefix-1', prefixes), true);
  assert.equal(manager.chatMatchesFilter('🟡 ObtainX', 'prefix-0', prefixes), false);
  assert.equal(manager.chatMatchesFilter('GitHub ✔', 'prefix-0', prefixes), false);
});

test('filters follow configured emoji changes rather than the default palette', () => {
  const custom = ['✅', '🔵'];
  assert.equal(manager.chatMatchesFilter('✅ [12] Work', 'numbered', custom), true);
  assert.equal(manager.chatMatchesFilter('✅ Work', 'prefix-0', custom), true);
  assert.equal(manager.chatMatchesFilter('🔵 Work', 'prefix-1', custom), true);
  assert.equal(manager.chatMatchesFilter('🟡 Work', 'prefix-1', custom), false);
});

test('active filters combine with OR and an empty set shows everything', () => {
  const chats = [{ id: 'a', title: '[1] A' }, { id: 'b', title: '🟡 B' }, { id: 'c', title: 'C' }];

  assert.deepEqual(manager.filterChats(chats, new Set(), prefixes), chats);
  assert.deepEqual(manager.filterChats(chats, new Set(['numbered', 'prefix-1']), prefixes).map((c) => c.id), ['a', 'b']);
});

test('filterChatsByQuery performs accent and case-insensitive matching in catalogue order', () => {
  const chats = [
    { id: '1', title: '[2] Capítulo de Larissa: preparar releitura de Lacan' },
    { id: '2', title: 'Releitura de Lacan e principais críticas' },
    { id: '3', title: '🟡 Zotero' },
    { id: '4', title: 'Álbum e crônica' },
  ];

  assert.deepEqual(manager.filterChatsByQuery(chats, 'lacan').map((c) => c.id), ['1', '2']);
  assert.deepEqual(manager.filterChatsByQuery(chats, 'LACAN').map((c) => c.id), ['1', '2']);
  assert.deepEqual(manager.filterChatsByQuery(chats, 'capitulo').map((c) => c.id), ['1']);
  assert.deepEqual(manager.filterChatsByQuery(chats, 'album').map((c) => c.id), ['4']);
  assert.deepEqual(manager.filterChatsByQuery(chats, ''), chats);
  assert.deepEqual(manager.filterChatsByQuery(chats, '   '), chats);
});

test('merging scan windows keeps sidebar order and never duplicates', () => {
  const chat = (id) => ({ id, title: id });
  let list = manager.mergeChatList([], [chat('a'), chat('b'), chat('c')]);

  list = manager.mergeChatList(list, [chat('b'), chat('c'), chat('d'), chat('e')]);
  list = manager.mergeChatList(list, [chat('x'), chat('a')]);

  assert.deepEqual(list.map((c) => c.id), ['x', 'a', 'b', 'c', 'd', 'e']);
});
test('withoutChatId removes matching chats and preserves order', () => {
  const chats = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }];
  assert.deepEqual(manager.withoutChatId(chats, 'b'), [{ id: 'a', title: 'A' }, { id: 'c', title: 'C' }]);
  assert.deepEqual(manager.withoutChatId(chats, 'unknown'), chats);
});

test('chat titles drop the unread counter so identities stay stable', () => {
  assert.equal(manager.cleanChatTitle('Resumos de grupos do Whatsapp 5 não lidas'), 'Resumos de grupos do Whatsapp');
  assert.equal(manager.cleanChatTitle('Assistente de WhatsApp 1 não lida'), 'Assistente de WhatsApp');
  assert.equal(manager.stripManagedPrefix('✔️ Caso Mourad'), 'Caso Mourad');
});

test('Radar with an unread counter and the notifications button are navigation, not chats', () => {
  assert.equal(manager.isNavigationActionLabel('Radar 4 não lidas'), true);
  assert.equal(manager.isNavigationActionLabel('Abrir notificações'), true);
  assert.equal(manager.isNavigationActionLabel('Radar de vagas'), false);
});

test('normalization supports text from browser controls', () => {
  assert.equal(manager.normalizeSpace('  Excluir\n chat  '), 'Excluir chat');
});

test('only exact native more-actions labels can open a chat menu', () => {
  assert.equal(manager.isMenuButtonLabel('Mais ações'), true);
  assert.equal(manager.isMenuButtonLabel('  options  '), true);
  assert.equal(manager.isMenuButtonLabel('Informações do chat'), false);
});

test('Flutter hover action is never treated as a chat title', () => {
  assert.equal(manager.isHoverActionLabel('Mais ações'), true);
  assert.equal(manager.isHoverActionLabel('More actions'), true);
  assert.equal(manager.isHoverActionLabel('Informações do chat'), false);
});

test('known Flutter navigation labels are not treated as chat titles', () => {
  assert.equal(manager.isNavigationActionLabel('Novo Chat'), true);
  assert.equal(manager.isNavigationActionLabel('Radar 6'), true);
  assert.equal(manager.isNavigationActionLabel('Conversas'), true);
  assert.equal(manager.isNavigationActionLabel('Indique e ganhe'), true);
  assert.equal(manager.isNavigationActionLabel('Outlook conectado e resumo de e-mails'), false);
});

test('nested chat candidates collapse to root chat rows', () => {
  const inner = { contains: () => false };
  const sibling = { contains: () => false };
  const outer = { contains: (o) => o === inner };

  assert.deepEqual(manager.selectRootChatRows([outer, inner, sibling]), [outer, sibling]);
});

function node(managed) {
  return {
    nodeType: 1,
    closest: () => (managed ? {} : null),
  };
}

test('the observer ignores mutations produced by its own controls', () => {
  const managedToolbar = node(true);
  const pageRow = node(false);
  const managedControl = node(true);
  const pageContent = node(false);

  assert.equal(manager.needsRemount([{ target: managedToolbar, addedNodes: [pageContent], removedNodes: [] }]), false);
  assert.equal(manager.needsRemount([{ target: pageRow, addedNodes: [managedControl], removedNodes: [] }]), false);
  assert.equal(manager.needsRemount([{ target: pageRow, addedNodes: [pageContent], removedNodes: [] }]), true);
});

test('the chat manager stays hidden until Zapia renders a chat row', () => {
  assert.equal(manager.shouldShowChatManager([]), false);
  assert.equal(manager.shouldShowChatManager([{}]), true);
});

test('the Zapia cache recovery request clears only Zapia’s stale-cache marker once', () => {
  const data = new Map([['zapia_cache_flushed_v7', '1'], ['session', 'preserved']]);
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };

  assert.equal(manager.requestZapiaCacheRecovery(storage), true);
  assert.equal(data.has('zapia_cache_flushed_v7'), false);
  assert.equal(data.get('session'), 'preserved');
  assert.equal(manager.requestZapiaCacheRecovery(storage), false);
});
test('pinnedBetweenSections verifies bounding range', () => {
  assert.equal(manager.pinnedBetweenSections(300, 250, 600), true);
  assert.equal(manager.pinnedBetweenSections(200, 250, 600), false);
  assert.equal(manager.pinnedBetweenSections(600, 250, 600), false);
  assert.equal(manager.pinnedBetweenSections(300, null, 600), false);
  assert.equal(manager.pinnedBetweenSections(300, 250, undefined), false);
});

test('catalogueView preserves native order when no priority or filter is enabled', () => {
  const sample = [
    { id: '1', title: '🟡 Agent 1', pinned: true },
    { id: '2', title: '[10] Task', pinned: false },
    { id: '3', title: '✔ Done', pinned: false },
    { id: '4', title: 'Plain', pinned: false },
  ];
  const view = { prioritizeAgents: false, prioritizeIds: false, hideCompleted: false, onlyUnprefixed: false };
  assert.deepEqual(manager.catalogueView(sample, new Set(), prefixes, view), sample);
});

test('catalogueView prioritizes agents then pending IDs after pinned chats', () => {
  const sample = [
    { id: 'p1', title: 'Pinned regular', pinned: true },
    { id: 'p2', title: '✔ Pinned done', pinned: true },
    { id: 'r1', title: 'Ordinary 1', pinned: false },
    { id: 'a1', title: '🟡 Agent Alpha', pinned: false },
    { id: 't1', title: '[1] Open bug', pinned: false },
    { id: 't2', title: '✔ [2] Fixed bug', pinned: false },
    { id: 'a2', title: '🟡 [99] Agent with ID', pinned: false },
    { id: 'r2', title: 'Ordinary 2', pinned: false },
  ];

  // prioritizeAgents only
  const justAgents = manager.catalogueView(sample, new Set(), prefixes, {
    prioritizeAgents: true, prioritizeIds: false, hideCompleted: false, onlyUnprefixed: false,
  });
  assert.deepEqual(justAgents.map((c) => c.id), ['p1', 'p2', 'a1', 'a2', 'r1', 't1', 't2', 'r2']);

  // prioritizeIds only: pending IDs promoted, completed IDs NOT promoted
  const justIds = manager.catalogueView(sample, new Set(), prefixes, {
    prioritizeAgents: false, prioritizeIds: true, hideCompleted: false, onlyUnprefixed: false,
  });
  assert.deepEqual(justIds.map((c) => c.id), ['p1', 'p2', 't1', 'a2', 'r1', 'a1', 't2', 'r2']);

  // Both priorities enabled: pinned -> agents -> pending IDs -> remainder
  const both = manager.catalogueView(sample, new Set(), prefixes, {
    prioritizeAgents: true, prioritizeIds: true, hideCompleted: false, onlyUnprefixed: false,
  });
  assert.deepEqual(both.map((c) => c.id), ['p1', 'p2', 'a1', 'a2', 't1', 'r1', 't2', 'r2']);
});

test('catalogueView hideCompleted removes completed chats including pinned ones', () => {
  const sample = [
    { id: 'p1', title: 'Pinned regular', pinned: true },
    { id: 'p2', title: '✔ Pinned done', pinned: true },
    { id: 't1', title: '[1] Open task', pinned: false },
    { id: 't2', title: '✔ [2] Done task', pinned: false },
    { id: 'r1', title: 'Regular', pinned: false },
  ];
  const result = manager.catalogueView(sample, new Set(), prefixes, {
    prioritizeAgents: false, prioritizeIds: false, hideCompleted: true, onlyUnprefixed: false,
  });
  assert.deepEqual(result.map((c) => c.id), ['p1', 't1', 'r1']);
});

test('catalogueView onlyUnprefixed keeps pinned chats and filters remainder to unprefixed only', () => {
  const sample = [
    { id: 'p1', title: '🟡 Pinned agent', pinned: true },
    { id: 'p2', title: 'Pinned regular', pinned: true },
    { id: 'p3', title: '✔ Pinned done', pinned: true },
    { id: 'a1', title: '🟡 Agent', pinned: false },
    { id: 't1', title: '[5] Numbered', pinned: false },
    { id: 'd1', title: '✔ Done', pinned: false },
    { id: 'u1', title: 'Conversa sem prefixo 1', pinned: false },
    { id: 'u2', title: 'Conversa sem prefixo 2', pinned: false },
  ];

  const result = manager.catalogueView(sample, new Set(), prefixes, {
    prioritizeAgents: true, prioritizeIds: true, hideCompleted: false, onlyUnprefixed: true,
  });
  // Pinned are kept; remainder has only u1 and u2. Priorities are bypassed.
  assert.deepEqual(result.map((c) => c.id), ['p1', 'p2', 'p3', 'u1', 'u2']);

  // Combined with hideCompleted, pinned done is also removed
  const withHide = manager.catalogueView(sample, new Set(), prefixes, {
    prioritizeAgents: true, prioritizeIds: true, hideCompleted: true, onlyUnprefixed: true,
  });
  assert.deepEqual(withHide.map((c) => c.id), ['p1', 'p2', 'u1', 'u2']);
});

test('selected chats include reusable agents and titles require only confirmation', () => {
  const sample = [
    { id: 'a1', title: '🟡 Agente de E-mails' },
    { id: 'c1', title: 'Chat comum' },
    { id: 'a2', title: '🟡 [2] Agente WhatsApp' },
    { id: 'c2', title: '[1] Tarefa comum' },
  ];
  const ids = new Set(['a1', 'c1', 'a2', 'c2']);
  const selected = manager.selectedChats(sample, ids);
  assert.deepEqual(selected.map((chat) => chat.id), ['a1', 'c1', 'a2', 'c2']);

  assert.throws(() => manager.assertChatTitle(''), /Unable to confirm the chat title/);
  assert.doesNotThrow(() => manager.assertChatTitle('🟡 Agente'));
  assert.doesNotThrow(() => manager.assertChatTitle('🟡 [1] Agente'));
  assert.doesNotThrow(() => manager.assertChatTitle('Chat normal'));
  assert.doesNotThrow(() => manager.assertChatTitle('[1] Chat com ID'));
  assert.doesNotThrow(() => manager.assertChatTitle('✔ Concluído'));
});

test('loadPreferences restores view options and default panel state', () => {
  const custom = {
    prefixes: ['✅', '🟠'],
    shortcuts: {
      'prefix-check': { altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, code: 'KeyC' },
      'prefix-yellow': { altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, code: 'KeyY' },
      delete: { altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, code: 'KeyX' },
    },
    view: { prioritizeAgents: true, prioritizeIds: true, hideCompleted: false, onlyUnprefixed: false },
  };
  const storage = { getItem: () => JSON.stringify(custom) };
  const loaded = manager.loadPreferences(storage);
  assert.deepEqual(loaded.view, {
    prioritizeAgents: true,
    prioritizeIds: true,
    hideCompleted: false,
    onlyUnprefixed: false,
  });
  assert.deepEqual(loaded.panel, { minimized: false });

  const minimized = manager.loadPreferences({
    getItem: () => JSON.stringify({ ...custom, panel: { minimized: true } }),
  });
  assert.deepEqual(minimized.panel, { minimized: true });
});

test('excludeHiddenChats removes hidden chat IDs while preserving catalogue ordering', () => {
  const chats = [
    { id: '1', title: 'Normal' },
    { id: '2', title: 'Broken Thread' },
    { id: '3', title: 'Agent' },
  ];

  assert.deepEqual(manager.excludeHiddenChats(chats, [{ id: '2', title: 'Broken Thread' }]), [
    { id: '1', title: 'Normal' },
    { id: '3', title: 'Agent' },
  ]);
  assert.deepEqual(manager.excludeHiddenChats(chats, []), chats);
});

test('buildSupportDiagnosticPayload creates structured, privacy-safe report for Zapia support', () => {
  const payload = manager.buildSupportDiagnosticPayload(new Error('Zapia did not expose the selected chat header.'), {
    id: 'ape@079ca3e6-1c26-5c59-be32-01a36c9e3457',
    title: 'Broken Chat',
    url: 'https://app.zapia.com/chat?pulsusNumber=ape@079ca3e6-1c26-5c59-be32-01a36c9e3457',
    userAgent: 'Mozilla/5.0 TestBrowser',
  });

  assert.equal(payload.error, 'Zapia did not expose the selected chat header.');
  assert.equal(payload.chatId, 'ape@079ca3e6-1c26-5c59-be32-01a36c9e3457');
  assert.equal(payload.chatTitle, 'Broken Chat');
  assert.equal(payload.currentUrl, 'https://app.zapia.com/chat?pulsusNumber=ape@079ca3e6-1c26-5c59-be32-01a36c9e3457');
  assert.equal(payload.userAgent, 'Mozilla/5.0 TestBrowser');
  assert.ok(payload.timestamp);
  assert.ok(payload.instructions.includes('Zapia support'));
});

test('isUnavailableChatError recognizes header timeout and render failures but rejects generic errors', () => {
  assert.equal(
    manager.isUnavailableChatError(new Error('Zapia did not expose the selected chat header.')),
    true,
  );
  assert.equal(
    manager.isUnavailableChatError(new Error('Zapia did not render chat text:test chat id.')),
    true,
  );
  assert.equal(
    manager.isUnavailableChatError(new Error('Wait for the current action to finish.')),
    false,
  );
  assert.equal(
    manager.isUnavailableChatError(new Error('Unable to confirm the chat title.')),
    false,
  );
  assert.equal(manager.isUnavailableChatError(null), false);
});

test('safeProfileTop preserves observed profile top but reserves a safe bottom gutter', () => {
  // Profile discovered near bottom (e.g., 720px in an 820px window)
  assert.equal(manager.safeProfileTop(720, 820), 720);
  // Profile missing or returned full window height: clamped by safe gutter (820 - 80 = 740)
  assert.equal(manager.safeProfileTop(820, 820), 740);
  assert.equal(manager.safeProfileTop(undefined, 820), 740);
  // Degenerate zero or negative height
  assert.equal(manager.safeProfileTop(500, 0), 0);
});

test('pointInChatViewport safely handles missing viewport or points outside', () => {
  assert.equal(manager.pointInChatViewport(null, 50, 100), false);
  assert.equal(manager.pointInChatViewport({}, 50, 100), false);
  const vp = {
    navRect: { left: 0, right: 280, top: 0 },
    bottom: 720,
  };
  assert.equal(manager.pointInChatViewport(vp, 100, 300), true);
  assert.equal(manager.pointInChatViewport(vp, 300, 300), false); // outside right
  assert.equal(manager.pointInChatViewport(vp, 100, 750), false); // outside bottom
  assert.equal(manager.pointInChatViewport(vp, NaN, 300), false);
});

test('isChatHeaderControl accepts buttons in the chat header band and rejects messages, links, cards, or grouped elements', () => {
  // Real Zapia header "Mais ações" button
  assert.equal(manager.isChatHeaderControl({
    parentRole: null,
    rect: { left: 931, top: 8, width: 44, height: 44 },
    navRight: 280,
  }), true);

  // Button nested inside a message card / rich link (Flutter groups messages)
  assert.equal(manager.isChatHeaderControl({
    parentRole: 'group',
    rect: { left: 326, top: 12, width: 200, height: 40 },
    navRight: 280,
  }), false);

  // Button below header area (e.g., inside message list, copy, share, audio)
  assert.equal(manager.isChatHeaderControl({
    parentRole: null,
    rect: { left: 347, top: 392, width: 36, height: 36 },
    navRight: 280,
  }), false);

  // Button inside sidebar / navigation band
  assert.equal(manager.isChatHeaderControl({
    parentRole: null,
    rect: { left: 200, top: 10, width: 36, height: 36 },
    navRight: 280,
  }), false);
});

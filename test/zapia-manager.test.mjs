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

test('current-chat shortcuts accept only the intended unmodified chords', () => {
  assert.equal(manager.currentChatShortcut({ altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, repeat: false, code: 'KeyC' }), 'prefix-check');
  assert.equal(manager.currentChatShortcut({ altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, repeat: false, code: 'KeyY' }), 'prefix-yellow');
  assert.equal(manager.currentChatShortcut({ altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, repeat: false, code: 'KeyX' }), 'delete');
  assert.equal(manager.currentChatShortcut({ altKey: true, shiftKey: false, ctrlKey: false, metaKey: false, repeat: false, code: 'KeyC' }), null);
  assert.equal(manager.currentChatShortcut({ altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, repeat: true, code: 'KeyX' }), null);
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

test('the native chat menu is detected only by an exact Renomear item inside a group', () => {
  assert.equal(manager.hasNativeChatMenu([{ label: 'Renomear', parentRole: 'group' }]), true);
  assert.equal(manager.hasNativeChatMenu([{ label: 'Renomear', parentRole: null }]), false);
  assert.equal(manager.hasNativeChatMenu([{ label: 'Edital para renomear', parentRole: 'group' }]), false);
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

test('merging scan windows keeps sidebar order and never duplicates', () => {
  const chat = (id) => ({ id, title: id });
  let list = manager.mergeChatList([], [chat('a'), chat('b'), chat('c')]);

  list = manager.mergeChatList(list, [chat('b'), chat('c'), chat('d'), chat('e')]);
  list = manager.mergeChatList(list, [chat('x'), chat('a')]);

  assert.deepEqual(list.map((c) => c.id), ['x', 'a', 'b', 'c', 'd', 'e']);
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

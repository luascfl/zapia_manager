// ==UserScript==
// @name         Zapia Manager
// @namespace    https://github.com/luascfl/userscripts
// @version      0.5.35
// @description  Enhance Zapia's sidebar with a searchable chat catalogue, filters, selection, native actions and configurable shortcuts.
// @updateURL    https://raw.githubusercontent.com/luascfl/zapia_manager/main/zapia-manager.user.js
// @downloadURL  https://raw.githubusercontent.com/luascfl/zapia_manager/main/zapia-manager.user.js
// @match        https://app.zapia.com/chat*
// @match        https://app.zapia.com/chat/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const DEFAULT_PREFERENCES = Object.freeze({
    prefixes: ['✔', '🟡'],
    view: { prioritizeAgents: false, prioritizeIds: false, hideCompleted: false, onlyUnprefixed: false },
    panel: { minimized: false },
    copy: { includeActivity: false },
    hiddenChats: [],
    shortcuts: {
      'prefix-check': { altKey: true, shiftKey: false, ctrlKey: false, metaKey: false, code: 'KeyC' },
      'prefix-yellow': { altKey: true, shiftKey: false, ctrlKey: false, metaKey: false, code: 'KeyY' },
      delete: { altKey: true, shiftKey: false, ctrlKey: false, metaKey: false, code: 'KeyX' },
    },
  });

  const PREFERENCES_STORAGE_KEY = 'zapia_manager_preferences_v1';
  let preferences = structuredClone(DEFAULT_PREFERENCES);

  const CHAT_ROW_SELECTORS = [
    'a[href*="/chat/"]',
    '[data-testid*="chat-item" i]',
    '[data-testid*="conversation-item" i]',
    '[role="listitem"][data-chat-id]',
    'flt-semantics[role="button"]',
  ];

  const NAVIGATION_ACTION_LABELS = new Set([
    'Novo Chat',
    'Buscar',
    'Agendados',
    'Radar',
    'Conectores',
    'Compartilhe e ganhe',
    'Indique e ganhe',
    'Fixados',
    'Conversas',
    'Abrir notificações',
  ]);

  const PRIMARY_NAVIGATION_LABELS = new Set([
    'Novo Chat',
    'Buscar',
    'Agendados',
    'Radar',
    'Conectores',
    'Compartilhe e ganhe',
    'Indique e ganhe',
  ]);
  const PROMO_NAVIGATION_PATTERN = /^ganhe o zapia pro\b/i;
  const RADAR_NAVIGATION_PATTERN = /^Radar(?:\s+\d+(?:\s+não\s+lidas?)?)?$/u;

  const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/u;
  const MENU_BUTTON_PATTERN = /^(?:menu|more|options|opções|mais ações|actions)$/i;
  const DELETE_PATTERN = /(?:excluir|apagar|deletar|delete|remove)/i;
  const MENU_RENAME_ACTION = /^(?:renomear|rename)$/i;
  const MENU_DELETE_ACTION = /^(?:excluir|delete)$/i;
  const HOVER_ACTION_PATTERN = /^(?:mais ações|more actions)$/i;

  const selectedChatIds = new Set();
  let deletionQueue = [];
  let catalogueSearchOpen = false;
  let catalogueSearchQuery = '';
  const HEADER_CLIP_TOP = 50;
  const PROFILE_SAFE_BOTTOM_GUTTER = 80;
  const PROFILE_BAR_PADDING = 20;
  let observerScheduled = false;
  let settingsOpen = false;

  function normalizeSpace(value) {
    return String(value ?? '').replace(/\s+/gu, ' ').trim();
  }

  // Zapia words the Radar prompt differently across Portuguese locales.
  const RADAR_PROMPT_PATTERN = /^(?:Diz-me|Me diga) o que fazer$/u;

  const CHAT_HEADER_BOTTOM = 70;

  function isChatHeaderControl({ parentRole, rect, navRight }) {
    return parentRole !== 'group'
      && rect.left >= navRight
      && rect.top >= 0
      && rect.top < CHAT_HEADER_BOTTOM;
  }

  // The conversation body: right of the sidebar, below the header, above the composer.
  function isChatBodyPoint({ clientX, clientY, navRight, composerTop }) {
    return clientX >= navRight
      && clientY >= CHAT_HEADER_BOTTOM
      && clientY < composerTop;
  }

  function isMenuButtonLabel(label) {
    return MENU_BUTTON_PATTERN.test(normalizeSpace(label));
  }

  function isHoverActionLabel(label) {
    return HOVER_ACTION_PATTERN.test(normalizeSpace(label));
  }

  function isNavigationActionLabel(label) {
    const normalized = normalizeSpace(label);

    if (
      NAVIGATION_ACTION_LABELS.has(normalized)
      || PROMO_NAVIGATION_PATTERN.test(normalized)
      || RADAR_NAVIGATION_PATTERN.test(normalized)
    ) {
      return true;
    }

    return normalized.includes('Logo Zapia') || EMAIL_PATTERN.test(normalized);
  }

  function cleanChatTitle(text) {
    return text
      .replace(
        /\s*(?:Renomear|Excluir|Fixar|Desafixar|Reportar|Mais ações|Compartilhar|Ouvir|Boa Resposta|Resposta ruim|Editar|Opções|Menu|Share|Delete|Rename|Pin|Unpin|Options|\.\.\.)+$/gi,
        '',
      )
      .replace(/\s+\d+\s+não\s+lidas?$/iu, '')
      .trim();
  }

  function configuredPrefixes() {
    return [
      ...new Set([
        ...DEFAULT_PREFERENCES.prefixes,
        ...preferences.prefixes,
      ]),
    ].map((emoji) => `${emoji} `);
  }

  function stripManagedPrefix(title) {
    const escaped = configuredPrefixes()
      .map((prefix) => prefix.trim().replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
      .join('|');

    return String(title ?? '').replace(
      new RegExp(`^(?:${escaped})\\uFE0F?\\s*`, 'u'),
      '',
    );
  }

  function withPrefix(title, prefix) {
    if (!configuredPrefixes().includes(prefix)) {
      throw new Error(`Unsupported Zapia label: ${prefix}`);
    }

    return `${prefix}${stripManagedPrefix(title).trimStart()}`;
  }

  function normalizeEmoji(value) {
    return String(value ?? '').replace(/\uFE0F/gu, '');
  }

  function chatMatchesFilter(title, filter, prefixes) {
    const plain = normalizeEmoji(title).trimStart();

    if (filter === 'numbered') {
      const prefix = [...DEFAULT_PREFERENCES.prefixes, ...prefixes]
        .map(normalizeEmoji)
        .find((emoji) => plain.startsWith(emoji));
      return /^\[\d+\]/u.test((prefix ? plain.slice(prefix.length) : plain).trimStart());
    }

    const index = filter === 'prefix-0' ? 0 : filter === 'prefix-1' ? 1 : -1;

    return index >= 0
      && plain.startsWith(normalizeEmoji(prefixes[index]));
  }

  function filterChats(chats, filters, prefixes) {
    if (!filters.size) return chats;

    return chats.filter(({ title }) =>
      [...filters].some((filter) => chatMatchesFilter(title, filter, prefixes)),
    );
  }

  function normalizeSearchText(value) {
    return normalizeSpace(value)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase();
  }

  function filterChatsByQuery(chats, query) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return chats;
    return chats.filter(({ title }) => normalizeSearchText(title).includes(normalizedQuery));
  }

  function catalogueView(chats, filters, prefixes, view) {
    const groups = [[], [], [], []];
    const promoted = !view.onlyUnprefixed && (view.prioritizeAgents || view.prioritizeIds);
    // "unread" narrows whatever else is shown; the other filters are alternatives to one another.
    const unreadOnly = filters.has('unread');
    const typeFilters = new Set([...filters].filter((filter) => filter !== 'unread'));
    const byFilter = new Set(filterChats(chats, typeFilters, prefixes));
    for (const chat of chats) {
      const completed = chatMatchesFilter(chat.title, 'prefix-0', prefixes);
      const agent = chatMatchesFilter(chat.title, 'prefix-1', prefixes);
      const numbered = chatMatchesFilter(chat.title, 'numbered', prefixes);
      const unprefixed = chat.pinned || !(completed || agent || numbered);
      if (typeFilters.size || view.onlyUnprefixed) {
        const shown = (typeFilters.size > 0 && byFilter.has(chat))
          || (view.onlyUnprefixed && unprefixed);
        if (!shown) continue;
      }
      if (unreadOnly && !(chat.unread > 0 || chat.pending)) continue;
      // Asking explicitly for completed or unread chats beats the option that hides completed ones.
      if (view.hideCompleted && completed && !typeFilters.has('prefix-0') && !unreadOnly) continue;
      const rank = !promoted ? 0 : chat.pinned ? 0
        : view.prioritizeAgents && agent ? 1
          : view.prioritizeIds && numbered && !completed ? 2 : 3;
      groups[rank].push(chat);
    }
    return groups.flat();
  }

  function excludeHiddenChats(chats, hiddenChats = preferences.hiddenChats) {
    const hiddenIds = new Set((hiddenChats ?? []).map((item) => (typeof item === 'string' ? item : item.id)));
    return chats.filter((chat) => !hiddenIds.has(chat.id));
  }

  const SPECIAL_THREAD_KEY = /^ape@(?:home|notifications)_/u;
  const THREAD_LIST_PARAMS = new Set([
    'limit', 'before', 'has_unread', 'contact_number', 'device_id', 'user_email', 'auth_token',
  ]);

  function matchKey(text) {
    return String(text).normalize('NFC').replace(/\uFE0F/gu, '').replace(/\s+/gu, ' ').trim();
  }

  // pages: [{ before, nextCursor, hasMore, threads: [{ id, label }] }]. Returns the
  // full server thread list (Map id -> thread) only when the page chain from the
  // first page to a page with hasMore=false was observed without gaps.
  function threadListFromPages(pages) {
    const byCursor = new Map(pages.map((page) => [page.before, page]));
    const visited = new Set();
    const threads = new Map();
    let cursor = null;

    for (;;) {
      if (visited.has(cursor)) return null;
      visited.add(cursor);
      const page = byCursor.get(cursor);
      if (!page) return null;
      for (const thread of page.threads) threads.set(thread.id, thread);
      if (!page.hasMore) return threads;
      if (!page.nextCursor) return null;
      cursor = page.nextCursor;
    }
  }

  // Cached thread keys that the server no longer lists. The special home and
  // notifications threads are not part of the regular list and are never stale.
  function findStaleThreadIds(cacheKeys, serverIds) {
    if (!(serverIds?.size > 0)) return [];
    return cacheKeys.filter((key) =>
      typeof key === 'string'
      && key.startsWith('ape@')
      && !SPECIAL_THREAD_KEY.test(key)
      && !serverIds.has(key));
  }

  const MEDIA_MESSAGE_TYPES = new Set(['IMAGE', 'MEDIA']);

  // Pages arrive newest first and overlap at their boundaries.
  function mergeMessagePages(pages) {
    const byId = new Map();
    for (const page of pages) {
      for (const message of page) byId.set(message.message_id, message);
    }
    return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
  }

  function formatMessageTimestamp(iso) {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/u.exec(iso ?? '');
    return match ? `${match[1]} ${match[2]} UTC` : '';
  }

  // Conversation (text and media) always; agent activity (tool calls, cards,
  // drafts, intermediate notes) only on request. Returns null when skipped.
  function formatMessage(message, includeActivity) {
    const type = message.message_type;
    const isMedia = MEDIA_MESSAGE_TYPES.has(type);
    if (type !== 'TEXT' && !isMedia && !includeActivity) return null;

    const time = formatMessageTimestamp(message.created_at);
    const header = `**${message.role === 'user' ? 'User' : 'Assistant'}**${time ? ` · ${time}` : ''}`;
    const text = typeof message.content === 'string' ? message.content.trim() : '';
    let body;

    if (type === 'TEXT') {
      body = text;
    } else if (isMedia) {
      const caption = text || (typeof message.caption === 'string' ? message.caption.trim() : '');
      body = [
        `[${type === 'IMAGE' ? 'Image' : 'Media'}${message.file_name ? `: ${message.file_name}` : ''}]`,
        caption,
      ].filter(Boolean).join('\n');
    } else {
      body = `[${type}] ${text}`.trim();
    }

    return `${header}\n${body}`;
  }

  function formatChatContext(title, messages, includeActivity = false) {
    const rendered = messages
      .map((message) => formatMessage(message, includeActivity))
      .filter((entry) => entry !== null);
    return {
      count: rendered.length,
      text: `# ${title}\n\n${rendered.length ? rendered.join('\n\n') : '(no messages)'}`,
    };
  }

  function buildSupportDiagnosticPayload(error, context = {}) {
    return {
      timestamp: new Date().toISOString(),
      error: error?.message ?? String(error),
      chatId: context.id ?? null,
      chatTitle: context.title ?? null,
      currentUrl: context.url ?? null,
      userAgent: context.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : null),
      instructions: 'Provide this payload to Zapia support to report an unrecoverable/unavailable chat thread.',
    };
  }

  function isUnavailableChatError(error) {
    const message = error?.message ?? '';
    return message === 'Zapia did not expose the selected chat header.'
      || message.startsWith('Zapia did not render chat ');
  }

  function pinnedBetweenSections(position, start, end) {
    return Number.isFinite(start) && Number.isFinite(end) && position >= start && position < end;
  }

  function selectedChats(chats, ids) {
    return chats.filter((chat) => ids.has(chat.id));
  }

  function assertChatTitle(title) {
    if (!title) throw new Error('Unable to confirm the chat title. Deletion blocked.');
  }

  function mergeChatList(existing, found) {
    const result = [...existing];
    let anchor = -1;

    for (const chat of found) {
      const at = result.findIndex(({ id }) => id === chat.id);

      if (at >= 0) {
        result[at] = chat;
        anchor = at;
        continue;
      }

      let position = anchor + 1;
      if (!chat.pinned) {
        // A chat that is not pinned never goes inside the pinned block at the top.
        const firstUnpinned = result.findIndex((other) => !other.pinned);
        position = Math.max(position, firstUnpinned < 0 ? result.length : firstUnpinned);
      }
      result.splice(position, 0, chat);
      anchor = position;
    }

    return result;
  }

  function withoutChatId(chats, id) {
    return chats.filter((chat) => chat.id !== id);
  }


  function canActivateDeleteCandidate({ containerRole, label }) {
    return containerRole === 'menu'
      && DELETE_PATTERN.test(normalizeSpace(label));
  }

  function shortcutLabel(shortcut) {
    const key = shortcut.code
      .replace(/^Key/u, '')
      .replace(/^Digit/u, '');

    return [
      shortcut.ctrlKey && 'Ctrl',
      shortcut.altKey && 'Alt',
      shortcut.shiftKey && 'Shift',
      shortcut.metaKey && 'Meta',
      key,
    ]
      .filter(Boolean)
      .join('+');
  }

  function isShortcut(shortcut) {
    return shortcut
      && typeof shortcut.code === 'string'
      && /^(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2]))$/u.test(shortcut.code)
      && Boolean(
        shortcut.ctrlKey
        || shortcut.altKey
        || shortcut.shiftKey
        || shortcut.metaKey,
      );
  }

  function currentChatShortcut(event) {
    if (event.repeat) return null;

    for (const [action, shortcut] of Object.entries(preferences.shortcuts)) {
      if (
        shortcut.code === event.code
        && shortcut.altKey === event.altKey
        && shortcut.ctrlKey === event.ctrlKey
        && shortcut.metaKey === event.metaKey
      ) {
        if (shortcut.shiftKey === event.shiftKey || (shortcut.altKey && !shortcut.ctrlKey && !shortcut.metaKey)) {
          return action;
        }
      }
    }

    return null;
  }

  function selectRootChatRows(candidates) {
    return candidates.filter((row) =>
      !candidates.some((other) => other !== row && other.contains(row)),
    );
  }

  function isManagedNode(node) {
    const element = node?.nodeType === 1 ? node : node?.parentElement;

    return Boolean(
      element?.closest?.('[data-zapia-manager-control]'),
    );
  }

  function needsRemount(records) {
    return records.some((record) => {
      if (isManagedNode(record.target)) return false;

      const changedNodes = [
        ...record.addedNodes,
        ...record.removedNodes,
      ];

      return changedNodes.some((node) => !isManagedNode(node));
    });
  }

  function shouldShowChatManager(chatRows) {
    return chatRows.length > 0;
  }

  function requestZapiaCacheRecovery(storage) {
    const recoveryMarker = 'zapia_manager_cache_recovery_v1';
    const zapiaMarker = 'zapia_cache_flushed_v7';

    try {
      if (storage.getItem(recoveryMarker)) return false;

      storage.setItem(recoveryMarker, '1');
      storage.removeItem(zapiaMarker);

      return true;
    } catch {
      return false;
    }
  }

  function loadPreferences(storage) {
    try {
      const stored = JSON.parse(
        storage.getItem(PREFERENCES_STORAGE_KEY) || 'null',
      );

      if (
        !stored
        || !Array.isArray(stored.prefixes)
        || stored.prefixes.length !== 2
      ) {
        return structuredClone(DEFAULT_PREFERENCES);
      }

      const prefixes = stored.prefixes.map((emoji) => String(emoji).trim());
      const shortcuts = stored.shortcuts;

      if (
        prefixes.some((emoji) => !emoji || emoji.length > 16)
        || new Set(prefixes).size !== 2
        || !Object.values(shortcuts || {}).every(isShortcut)
        || Object.keys(shortcuts || {}).length !== 3
      ) {
        return structuredClone(DEFAULT_PREFERENCES);
      }

      const view = Object.fromEntries(Object.keys(DEFAULT_PREFERENCES.view)
        .map((key) => [key, stored.view?.[key] === true]));
      const panel = { minimized: stored.panel?.minimized === true };
      const copy = { includeActivity: stored.copy?.includeActivity === true };
      const hiddenChats = Array.isArray(stored.hiddenChats)
        ? stored.hiddenChats
            .map((item) => (typeof item === 'string' ? { id: item, title: item } : item))
            .filter((item) => item?.id && typeof item.id === 'string')
        : [];
      return { prefixes, shortcuts, view, panel, copy, hiddenChats };
    } catch {
      return structuredClone(DEFAULT_PREFERENCES);
    }
  }

  function savePreferences(next, storage) {
    preferences = loadPreferences({
      getItem: () => JSON.stringify(next),
    });

    storage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  }

  function parseShortcut(value) {
    const parts = String(value ?? '')
      .split('+')
      .map((part) => part.trim())
      .filter(Boolean);

    const key = parts.pop()?.toUpperCase();

    const code = /^[A-Z]$/u.test(key)
      ? `Key${key}`
      : /^[0-9]$/u.test(key)
        ? `Digit${key}`
        : /^F(?:[1-9]|1[0-2])$/u.test(key)
          ? key
          : null;

    const shortcut = {
      ctrlKey: parts.some((part) => /^ctrl$/i.test(part)),
      altKey: parts.some((part) => /^alt$/i.test(part)),
      shiftKey: parts.some((part) => /^shift$/i.test(part)),
      metaKey: parts.some((part) => /^meta$/i.test(part)),
      code,
    };

    return isShortcut(shortcut) ? shortcut : null;
  }

  function shortcutFromEvent(event) {
    return {
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      code: event.code,
    };
  }

  function shortcutValidationError(shortcut) {
    if (!isShortcut(shortcut)) {
      return 'Use a letter, number, or F1–F12 key together with Ctrl, Alt, Shift, or Meta.';
    }

    const label = shortcutLabel(shortcut);

    if (
      [
        'Alt+F4',
        'Ctrl+W',
        'Ctrl+T',
        'Ctrl+N',
        'Ctrl+R',
        'Ctrl+L',
        'Ctrl+Shift+W',
      ].includes(label)
    ) {
      return `${label} is reserved by the browser or operating system.`;
    }

    return null;
  }

  function safeProfileTop(detectedProfileTop, height, gutter = PROFILE_SAFE_BOTTOM_GUTTER) {
    if (!Number.isFinite(height) || height <= 0) return 0;
    const detectedTop = Number.isFinite(detectedProfileTop) ? detectedProfileTop : height;
    return Math.min(detectedTop, Math.max(0, height - gutter));
  }

  function pointInChatViewport(viewport, clientX, clientY) {
    const rect = viewport?.navRect;
    return Boolean(
      rect
      && Number.isFinite(clientX)
      && Number.isFinite(clientY)
      && Number.isFinite(rect.left)
      && Number.isFinite(rect.right)
      && Number.isFinite(rect.top)
      && Number.isFinite(viewport.bottom)
      && clientX >= rect.left
      && clientX < rect.right
      && clientY >= rect.top
      && clientY < viewport.bottom,
    );
  }

  function sidebarPlacement(nav, topOffset, profileTop, width, height) {
    if (!nav || topOffset === null || nav.left < 0 || nav.right > width || nav.width <= 0) return null;
    const top = Math.max(0, nav.top + topOffset);
    const bottom = Math.min(nav.bottom, profileTop, height);
    if (bottom <= top) return null;
    return { left: nav.left, top, width: nav.width, height: bottom - top, right: nav.right, bottom };
  }

  function rectanglesOverlap(first, second) {
    return first.left < second.right && first.right > second.left
      && first.top < second.bottom && first.bottom > second.top;
  }

  const testApi = {
    normalizeSpace,
    stripManagedPrefix,
    withPrefix,
    canActivateDeleteCandidate,
    isHoverActionLabel,
    isMenuButtonLabel,
    isChatHeaderControl,
    isChatBodyPoint,
    isNavigationActionLabel,
    sidebarPlacement,
    safeProfileTop,
    pointInChatViewport,
    rectanglesOverlap,
    selectRootChatRows,
    cleanChatTitle,
    chatMatchesFilter,
    filterChats,
    normalizeSearchText,
    filterChatsByQuery,
    mergeChatList,
    catalogueView,
    pinnedBetweenSections,
    excludeHiddenChats,
    threadListFromPages,
    findStaleThreadIds,
    mergeUnreadCounts,
    parseReplyStatus,
    RADAR_PROMPT_PATTERN,
    mergeMessagePages,
    formatChatContext,
    matchKey,
    titleFromCacheText,
    reconcileChatList,
    chatRangeIds,
    buildSupportDiagnosticPayload,
    isUnavailableChatError,
    selectedChats,
    assertChatTitle,
    isManagedNode,
    needsRemount,
    shouldShowChatManager,
    requestZapiaCacheRecovery,
    currentChatShortcut,
    withoutChatId,
    parseShortcut,
    shortcutLabel,
    shortcutFromEvent,
    shortcutValidationError,
    loadPreferences,
    MENU_RENAME_ACTION,
    MENU_DELETE_ACTION,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = testApi;
  }

  if (
    typeof window === 'undefined'
    || typeof document === 'undefined'
  ) {
    return;
  }

  const previousRuntime = window.__zapiaManager;
  let restoredState = previousRuntime?.snapshot();
  previousRuntime?.dispose();
  if (!restoredState) {
    const savedState = sessionStorage.getItem('zapia_manager_dev_snapshot');
    if (savedState) {
      restoredState = JSON.parse(savedState);
      sessionStorage.removeItem('zapia_manager_dev_snapshot');
    }
  }

  const lifetime = new AbortController();
  const ownedTimeouts = new Set();
  const ownedIntervals = new Set();
  const ownedFrames = new Set();
  const ownedObservers = new Set();
  const pendingWork = new Set();

  function assertRuntimeActive() {
    if (lifetime.signal.aborted) {
      throw new DOMException('Userscript instance replaced.', 'AbortError');
    }
  }

  function later(callback, delay) {
    const id = window.setTimeout(() => {
      ownedTimeouts.delete(id);
      if (!lifetime.signal.aborted) callback();
    }, delay);
    ownedTimeouts.add(id);
    return id;
  }

  function every(callback, delay) {
    const id = window.setInterval(callback, delay);
    ownedIntervals.add(id);
    return id;
  }

  function frame(callback) {
    const id = window.requestAnimationFrame((time) => {
      ownedFrames.delete(id);
      if (!lifetime.signal.aborted) callback(time);
    });
    ownedFrames.add(id);
    return id;
  }

  function disposeRuntime() {
    if (lifetime.signal.aborted) return;
    if (chatActionDepth > 0) {
      throw new Error('Wait for the native chat action to finish before replacing the userscript.');
    }
    lifetime.abort();
    for (const id of ownedTimeouts) window.clearTimeout(id);
    for (const id of ownedIntervals) window.clearInterval(id);
    for (const id of ownedFrames) window.cancelAnimationFrame(id);
    for (const observer of ownedObservers) observer.disconnect();
    for (const cancel of [...pendingWork]) cancel();
    ownedTimeouts.clear();
    ownedIntervals.clear();
    ownedFrames.clear();
    ownedObservers.clear();
    document.querySelectorAll('[data-zapia-manager-control], [data-zapia-manager-style]')
      .forEach((element) => element.remove());
  }

  function runtimeSnapshot() {
    return {
      chats: knownChats,
      filters: [...activeFilters],
      selection: [...selectedChatIds],
      sidebarTopOffset,
      activeCatalogueId,
      activeCatalogueUrl,
      listScroll: document.querySelector('.zapia-manager-chat-list')?.scrollTop ?? 0,
      complete: catalogueComplete,
    };
  }
  requestZapiaCacheRecovery(window.localStorage);
  preferences = loadPreferences(window.localStorage);

  function isVisible(element) {
    if (!(element instanceof Element)) return false;

    const style = window.getComputedStyle(element);

    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && element.getClientRects().length > 0;
  }

  function enableFlutterSemantics() {
    const placeholder = document.querySelector(
      'flt-semantics-placeholder[aria-label="Enable accessibility"]',
    );

    if (
      !placeholder
      || placeholder.dataset.zapiaManagerEnabled === 'true'
    ) {
      return false;
    }

    placeholder.dataset.zapiaManagerEnabled = 'true';
    placeholder.click();

    return true;
  }

  function chatIdentity(row) {
    const link = row.matches('a[href]')
      ? row
      : row.querySelector('a[href*="/chat/"]');

    const explicitId = row.getAttribute('data-chat-id')
      || row.getAttribute('data-conversation-id');

    const rawText = normalizeSpace(
      row.textContent
      || row.getAttribute('aria-label')
      || '',
    );

    return explicitId
      || link?.href
      || `text:${cleanChatTitle(rawText)}`;
  }

  function getChatViewport() {
    const nav = document.querySelector(
      'flt-semantics[aria-label="Menu de navegação"]',
    );

    if (!nav) return null;

    const navRect = nav.getBoundingClientRect();

    const buttons = [
      ...nav.querySelectorAll('flt-semantics[role="button"]'),
    ];

    const primaryBottom = buttons.reduce((bottom, button) => {
      const label = normalizeSpace(
        button.textContent
        || button.getAttribute('aria-label')
        || '',
      );

      if (
        PRIMARY_NAVIGATION_LABELS.has(label)
        || PROMO_NAVIGATION_PATTERN.test(label)
        || RADAR_NAVIGATION_PATTERN.test(label)
      ) {
        return Math.max(
          bottom,
          button.getBoundingClientRect().bottom,
        );
      }

      return bottom;
    }, HEADER_CLIP_TOP);

    const detectedProfileTop = buttons.reduce((top, button) => {
      const rect = button.getBoundingClientRect();

      const label = normalizeSpace(
        button.textContent
        || button.getAttribute('aria-label')
        || '',
      );

      if (
        rect.left > navRect.left + 5
        && EMAIL_PATTERN.test(label)
      ) {
        return Math.min(top, rect.top - PROFILE_BAR_PADDING);
      }

      return top;
    }, window.innerHeight);
    const profileTop = safeProfileTop(detectedProfileTop, window.innerHeight);

    return {
      nav,
      navRect,
      top: Math.max(HEADER_CLIP_TOP, primaryBottom),
      bottom: profileTop,
    };
  }

  function isFlutterChatRow(row, viewport, clip = true) {
    if (
      !viewport
      || !row.matches('flt-semantics[role="button"]')
    ) {
      return false;
    }

    if (!viewport.nav.contains(row)) return false;

    const label = normalizeSpace(
      row.textContent
      || row.getAttribute('aria-label')
      || '',
    );

    if (
      isNavigationActionLabel(label)
      || isHoverActionLabel(label)
    ) {
      return false;
    }

    const rowRect = row.getBoundingClientRect();

    if (rowRect.height < 20 || rowRect.height > 100) {
      return false;
    }

    return !clip
      || (
        rowRect.top >= viewport.top
        && rowRect.bottom <= viewport.bottom
      );
  }

  function hasChatHoverAction(viewport) {
    if (!viewport) return false;

    return [
      ...viewport.nav.querySelectorAll(
        'flt-semantics[role="button"]',
      ),
    ].some((element) => {
      if (
        !isVisible(element)
        || !isHoverActionLabel(semanticLabel(element))
      ) {
        return false;
      }

      const rect = element.getBoundingClientRect();

      return rect.top >= viewport.top
        && rect.bottom <= viewport.bottom;
    });
  }

  function discoverChatRows(viewport = getChatViewport(), clip = true) {
    const candidates = [
      ...document.querySelectorAll(
        CHAT_ROW_SELECTORS.join(','),
      ),
    ]
      .filter((row) =>
        isVisible(row)
        && !row.closest('[data-zapia-manager-control]'),
      )
      .filter((row) => normalizeSpace(row.textContent).length > 0)
      .filter((row) => isFlutterChatRow(row, viewport, clip));

    return selectRootChatRows(candidates).sort(
      (first, second) => first.getBoundingClientRect().top - second.getBoundingClientRect().top,
    );
  }

  function chatTitle(row) {
    const named = row.querySelector(
      '[data-testid*="title" i], [data-testid*="name" i], [class*="title" i], [class*="name" i]',
    );

    const rawText = normalizeSpace(
      named?.textContent
      || row.textContent
      || row.getAttribute('aria-label')
      || '',
    );

    return cleanChatTitle(rawText) || 'Untitled chat';
  }

  function semanticLabel(element) {
    const label = normalizeSpace(
      element.textContent
      || element.getAttribute('aria-label'),
    );

    return label.replace(/^(.+?)\s+\1$/u, '$1');
  }

  function semanticButtons() {
    return [
      ...document.querySelectorAll(
        'flt-semantics[role="button"]',
      ),
    ].filter((element) =>
      isVisible(element)
      && !element.closest('[data-zapia-manager-control]'),
    );
  }

  let browserTabTitleObserver = null;
  let browserTabTitleScheduled = false;

  function currentChatHeaderTitle() {
    const header = semanticButtons().find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left > 280 && rect.top >= 0 && rect.top < 70
        && /informações do chat/iu.test(element.getAttribute('aria-description') ?? '');
    });
    return header ? cleanChatTitle(normalizeSpace(header.textContent)) : '';
  }

  function getActiveChatTitleForBrowserTab() {
    const prefix = 'Informações do chat';

    const candidates = [
      ...document.querySelectorAll(
        'flt-semantics[role="button"]',
      ),
    ]
      .map((node) =>
        normalizeSpace(
          node.textContent
          || node.getAttribute('aria-label')
          || '',
        ).replace(/^(.+?)\s+\1$/u, '$1'),
      )
      .filter((label) =>
        label.startsWith(prefix)
        && label.slice(prefix.length).trim(),
      )
      .sort((first, second) =>
        first.length - second.length,
      );

    if (!candidates.length) return '';

    const title = cleanChatTitle(
      candidates[0].slice(prefix.length),
    ).trim();

    return title.slice(0, 120);
  }

  function syncBrowserTabTitle() {
    const chatTitle = getActiveChatTitleForBrowserTab();

    const nextTitle = chatTitle
      ? `${chatTitle} | Zapia`
      : 'Zapia';

    if (document.title !== nextTitle) {
      document.title = nextTitle;
    }
  }

  function scheduleBrowserTabTitleSync() {
    if (browserTabTitleScheduled) return;

    browserTabTitleScheduled = true;

    frame(() => {
      browserTabTitleScheduled = false;
      syncBrowserTabTitle();
    });
  }

  function installBrowserTabTitleSync() {
    if (browserTabTitleObserver) return;

    const start = () => {
      if (!document.documentElement) {
        later(start, 50);
        return;
      }

      browserTabTitleObserver = new MutationObserver(
        scheduleBrowserTabTitleSync,
      );
      ownedObservers.add(browserTabTitleObserver);

      browserTabTitleObserver.observe(
        document.documentElement,
        {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: [
            'aria-label',
            'role',
            'class',
            'style',
          ],
        },
      );

      scheduleBrowserTabTitleSync();

      every(
        syncBrowserTabTitle,
        500,
      );
    };

    start();
  }

  function semanticMenuButton() {
    const nav = getChatViewport()?.nav;
    const navRight = nav?.getBoundingClientRect().right ?? 280;

    return semanticButtons().find((element) =>
      !nav?.contains(element)
      && isMenuButtonLabel(semanticLabel(element))
      && isChatHeaderControl({
        parentRole: element.parentElement?.getAttribute('role'),
        rect: element.getBoundingClientRect(),
        navRight,
      }),
    ) ?? null;
  }

  function semanticButton(pattern) {
    return semanticButtons().find((element) =>
      pattern.test(semanticLabel(element)),
    ) ?? null;
  }

  function rowMenuButton(row) {
    const candidates = [
      ...row.querySelectorAll(
        'button:not([data-zapia-manager-control])',
      ),
    ];

    return candidates.find((button) => {
      const label = [
        button.getAttribute('aria-label'),
        button.title,
        button.textContent,
      ]
        .filter(Boolean)
        .join(' ');

      return isMenuButtonLabel(label)
        || normalizeSpace(button.textContent) === '...';
    }) ?? null;
  }

  function waitFor(find, description, timeoutMs = 5000) {
    assertRuntimeActive();
    return new Promise((resolve, reject) => {
      let timeoutId;
      const cleanup = () => {
        observer.disconnect();
        ownedObservers.delete(observer);
        window.clearTimeout(timeoutId);
        ownedTimeouts.delete(timeoutId);
        pendingWork.delete(cancel);
      };
      const cancel = () => {
        cleanup();
        reject(new DOMException('Userscript instance replaced.', 'AbortError'));
      };
      const check = () => {
        const result = find();
        if (result) {
          cleanup();
          resolve(result);
        }
      };
      const observer = new MutationObserver(check);
      ownedObservers.add(observer);
      pendingWork.add(cancel);
      timeoutId = later(() => {
        cleanup();
        reject(new Error(`Zapia did not render ${description}.`));
      }, timeoutMs);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-expanded', 'data-state', 'style', 'class'],
      });
      check();
    });
  }

  function visibleMenus() {
    return [
      ...document.querySelectorAll(
        '[role="menu"], [data-radix-menu-content], [data-radix-popper-content-wrapper]',
      ),
    ].filter(isVisible);
  }

  function visibleSemanticMenuAction(pattern) {
    return semanticButtons().filter((element) => {
      const group = element.parentElement;

      return group?.getAttribute('role') === 'group'
        && pattern.test(semanticLabel(element));
    }).at(-1) ?? null;
  }

  function visibleMenuAction(pattern) {
    for (const menu of visibleMenus()) {
      const action = [
        ...menu.querySelectorAll(
          '[role="menuitem"], button, [role="button"]',
        ),
      ].find((element) =>
        pattern.test(
          normalizeSpace(
            element.textContent
            || element.getAttribute('aria-label'),
          ),
        ),
      );

      if (action) return action;
    }

    return visibleSemanticMenuAction(pattern);
  }

  function nativeRenameInput() {
    const dialog = [
      ...document.querySelectorAll(
        'dialog, [role="dialog"], [data-radix-dialog-content]',
      ),
    ]
      .filter(isVisible)
      .find((candidate) =>
        candidate.querySelector(
          'input:not([type="checkbox"]):not([type="radio"]), textarea',
        ),
      );

    if (dialog) {
      return dialog.querySelector(
        'input:not([type="checkbox"]):not([type="radio"]), textarea',
      );
    }

    const focused = document.activeElement;

    if (
      (
        focused instanceof HTMLInputElement
        || focused instanceof HTMLTextAreaElement
      )
      && isVisible(focused)
      && !focused.closest('[data-zapia-manager-control]')
    ) {
      return focused;
    }

    return null;
  }

  function nativeDeleteDialog() {
    const htmlDialog = [
      ...document.querySelectorAll(
        'dialog, [role="dialog"], [data-radix-alert-dialog-content]',
      ),
    ]
      .filter(isVisible)
      .find((dialog) =>
        DELETE_PATTERN.test(normalizeSpace(dialog.textContent)),
      );

    if (htmlDialog) return htmlDialog;

    return [
      ...document.querySelectorAll('flt-semantics'),
    ]
      .filter(isVisible)
      .find((group) => {
        const labels = [
          ...group.querySelectorAll(
            ':scope flt-semantics[role="button"]',
          ),
        ].map(semanticLabel);

        return /excluir conversa\?|delete conversation\?/i.test(
          normalizeSpace(group.textContent),
        )
          && labels.some((label) =>
            /^(?:excluir|delete)$/i.test(label),
          )
          && labels.some((label) =>
            /^(?:cancelar|cancel)$/i.test(label),
          );
      }) ?? null;
  }

  function nativeDeleteDialogOpen() {
    return nativeDeleteDialog() !== null;
  }

  function nativeDeleteConfirmAction() {
    const dialog = nativeDeleteDialog();

    if (!dialog) return null;

    return [
      ...dialog.querySelectorAll(
        'button, [role="button"], flt-semantics[role="button"]',
      ),
    ].find((button) =>
      /^(?:excluir|delete)$/i.test(semanticLabel(button)),
    ) ?? null;
  }

  function setInputValue(input, value) {
    const prototype = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;

    const setter = Object.getOwnPropertyDescriptor(
      prototype,
      'value',
    )?.set;

    setter?.call(input, value);

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function visibleSaveAction() {
    const htmlAction = [
      ...document.querySelectorAll(
        'dialog, [role="dialog"], [data-radix-dialog-content]',
      ),
    ]
      .filter(isVisible)
      .flatMap((dialog) => [
        ...dialog.querySelectorAll(
          'button, [role="button"]',
        ),
      ])
      .find((button) => {
        const label = normalizeSpace(
          button.textContent
          || button.getAttribute('aria-label'),
        );

        return /^(?:salvar|save|confirmar|confirm)$/i.test(label)
          && !DELETE_PATTERN.test(label);
      });

    return htmlAction
      ?? semanticButton(
        /^(?:salvar|save|confirmar|confirm|ok)$/i,
      );
  }

  function toast(message, kind = 'info') {
    if (lifetime.signal.aborted) return;
    const notice = document.createElement('output');

    notice.className = `zapia-manager-toast zapia-manager-toast-${kind}`;
    notice.dataset.zapiaManagerControl = 'true';
    notice.textContent = message;

    document.body.append(notice);

    later(() => notice.remove(), 4500);
  }

  async function dismissNativeMenu() {
    const action = visibleMenuAction(MENU_RENAME_ACTION);
    if (!action) return;
    action.focus();
    // Flutter applies semantic focus before routing keyboard events.
    await nextFrame();
    await nextFrame();
    for (const type of ['keydown', 'keyup']) {
      action.dispatchEvent(new KeyboardEvent(type, {
        key: 'Escape', code: 'Escape', keyCode: 27, which: 27,
        bubbles: true, cancelable: true,
      }));
    }
    await waitFor(() => !visibleMenuAction(MENU_RENAME_ACTION), 'the native chat menu to close');
  }

  async function activateNativeChat(row) {
    const id = chatIdentity(row);
    await dismissNativeMenu();
    if (!row.isConnected) row = await findChatRow(id);
    const before = location.href;
    const previousActiveId = activeCatalogueId;
    const previousActiveUrl = activeCatalogueUrl;
    const alreadyCurrent = activeCatalogueId === id && activeCatalogueUrl === before;
    activeCatalogueId = id;
    row.click();
    if (!alreadyCurrent) {
      try {
        await waitFor(
          () => location.href !== before ? semanticMenuButton() : null,
          'the selected chat to open', 3000,
        );
      } catch (error) {
        activeCatalogueId = previousActiveId;
        activeCatalogueUrl = previousActiveUrl;
        if (!semanticMenuButton()) {
          throw new Error('Zapia did not expose the selected chat header.');
        }
      }
    }
    await scrollSidebarToTop();
    activeCatalogueUrl = location.href;
  }

  async function openNativeActions(row) {
    const embeddedMenuButton = rowMenuButton(row);

    if (embeddedMenuButton) {
      embeddedMenuButton.click();
      return;
    }

    await activateNativeChat(row);
    const menuButton = await waitFor(semanticMenuButton, 'the selected chat native menu');
    menuButton.click();
  }

  async function openCurrentNativeActions() {
    if (visibleMenuAction(MENU_RENAME_ACTION) || visibleMenuAction(MENU_DELETE_ACTION)) {
      return;
    }

    const menuButton = await waitFor(
      semanticMenuButton,
      'the current chat native more-actions button',
    );

    menuButton.click();
  }

  async function applyPrefix(row, prefix) {
    if (row) {
      await openNativeActions(row);
    } else {
      await openCurrentNativeActions();
    }

    const editAction = await waitFor(
      () => visibleMenuAction(MENU_RENAME_ACTION),
      'the native rename action',
    );

    editAction.click();

    const input = await waitFor(
      nativeRenameInput,
      'the native rename dialog',
    );

    const saveAction = visibleSaveAction();

    if (!input || !saveAction) {
      throw new Error(
        'The native rename dialog does not expose a safe text input and save button.',
      );
    }

    setInputValue(input, withPrefix(input.value, prefix));
    saveAction.click();

    await waitFor(
      () => !input.isConnected || !isVisible(input),
      'the native rename dialog to close',
    );
  }

  async function deleteChat(row) {
    let expectedTitle = '';
    const targetId = row ? chatIdentity(row) : activeCatalogueId;
    if (row) {
      expectedTitle = chatTitle(row);
      assertChatTitle(expectedTitle);
      await activateNativeChat(row);
    }
    // The native header proves which chat is open; a stale header must never
    // be mistaken for the intended one before a destructive menu action.
    const nativeTitle = await waitFor(
      () => {
        const title = currentChatHeaderTitle();
        return title && (!expectedTitle || title === expectedTitle) ? title : null;
      },
      'the selected chat header',
    ).catch(() => '');
    assertChatTitle(nativeTitle);
    await openCurrentNativeActions();

    const deleteAction = await waitFor(
      () => visibleMenuAction(MENU_DELETE_ACTION),
      'the native delete menu action',
    );

    deleteAction.click();

    const confirmAction = await waitFor(
      nativeDeleteConfirmAction,
      'the native delete confirmation',
    );

    confirmAction.click();

    await waitFor(
      () => !nativeDeleteDialogOpen(),
      'the native delete confirmation to close',
    );

    if (targetId) {
      setKnownChats(withoutChatId(knownChats, targetId));
      selectedChatIds.delete(targetId);
      if (activeCatalogueId === targetId) activeCatalogueId = null;
    }
  }

  function button(label, title, handler) {
    const element = document.createElement('button');

    element.type = 'button';
    element.className = 'zapia-manager-button';
    element.dataset.zapiaManagerControl = 'true';
    element.textContent = label;
    element.title = title;
    element.setAttribute('aria-label', title);

    element.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      try {
        await handler();
      } catch (error) {
        toast(error.message, 'error');
      }
    });

    return element;
  }

  function isEditableTarget(target) {
    const candidates = [];

    if (target instanceof Element) {
      candidates.push(target);
    }

    if (document.activeElement instanceof Element) {
      candidates.push(document.activeElement);
    }

    return candidates.some((element) => {
      const role = element.getAttribute('role');
      const ariaMultiline = element.getAttribute('aria-multiline');

      return (
        element instanceof HTMLInputElement
        || element instanceof HTMLTextAreaElement
        || element instanceof HTMLSelectElement
        || element.isContentEditable
        || role === 'textbox'
        || ariaMultiline === 'true'
        || Boolean(
          element.closest(
            'input, textarea, select, [contenteditable="true"], [role="textbox"], flt-semantics[role="textbox"]',
          ),
        )
      );
    });
  }

  function hasFocusedTextEntry() {
    if (isEditableTarget(document.activeElement)) {
      return true;
    }

    return Boolean(
      document.querySelector(
        'input:focus, textarea:focus, select:focus, [contenteditable="true"]:focus, [role="textbox"]:focus, flt-semantics[role="textbox"]:focus, [aria-multiline="true"]:focus',
      ),
    );
  }

  let radarOverlayDetected = false;
  let radarInteractionActive = false;
  let radarProtectionInterval = null;

  function detectRadarOverlay() {
    let hasCloseButton = false;
    let hasRadarPrompt = false;

    const buttons = document.querySelectorAll(
      'flt-semantics[role="button"]',
    );

    for (const button of buttons) {
      const label = semanticLabel(button);

      if (label === 'Fechar') {
        hasCloseButton = true;
      }

      if (RADAR_PROMPT_PATTERN.test(label)) {
        hasRadarPrompt = true;
      }

      if (hasCloseButton && hasRadarPrompt) {
        return true;
      }
    }

    return false;
  }

  function radarTargetKind(target) {
    let element = target instanceof Element
      ? target
      : target?.parentElement;

    let depth = 0;

    while (element && depth < 12) {
      const label = normalizeSpace(
        element.textContent
        || element.getAttribute('aria-label')
        || '',
      );

      if (RADAR_PROMPT_PATTERN.test(label)) {
        return 'prompt';
      }

      if (label === 'Fechar') {
        return 'close';
      }

      if (label === 'Ações do radar') {
        return 'radar-action';
      }

      if (label === 'Seu radar de hoje') {
        return 'radar-header';
      }

      if (/^Cartão \d+ de \d+$/u.test(label)) {
        return 'radar-card';
      }

      element = element.parentElement;
      depth += 1;
    }

    return null;
  }

  function refreshRadarOverlayState() {
    const detected = detectRadarOverlay();

    if (detected) {
      radarOverlayDetected = true;
      return;
    }

    if (!radarInteractionActive) {
      radarOverlayDetected = false;
    }
  }

  function isRadarOverlayOpen() {
    return radarOverlayDetected || radarInteractionActive;
  }

  // With Flutter accessibility on (which this script needs), the semantic text field of the
  // Radar prompt is rebuilt ~100 ms after it takes focus, which drops focus and collapses the
  // prompt. Zapia behaves the same without this script once accessibility is enabled. Keeping
  // the semantics tree invisible while the field settles lets it stay open; the field's input
  // then receives focus so typing works.
  const RADAR_PROMPT_SETTLE_MS = 900;

  function shieldRadarPrompt() {
    const host = document.querySelector('flt-semantics-host');
    if (!host || host.dataset.zapiaManagerShield) return;

    const restore = () => {
      host.style.visibility = '';
      delete host.dataset.zapiaManagerShield;
    };

    host.dataset.zapiaManagerShield = 'true';
    host.style.visibility = 'hidden';
    lifetime.signal.addEventListener('abort', restore, { once: true });
    later(() => {
      restore();
      document.querySelector('flt-semantics input, flt-semantics textarea')?.focus();
    }, RADAR_PROMPT_SETTLE_MS);
  }

  function installRadarProtection() {
    if (radarProtectionInterval) return;

    const handlePointerDown = (event) => {
      const kind = radarTargetKind(event.target);

      if (!kind) return;

      if (kind === 'prompt') shieldRadarPrompt();

      if (kind === 'close') {
        radarInteractionActive = false;
        later(
          refreshRadarOverlayState,
          350,
        );
        return;
      }

      radarInteractionActive = true;
      radarOverlayDetected = true;
    };

    const handleFocusIn = (event) => {
      const kind = radarTargetKind(event.target);

      if (kind && kind !== 'close') {
        radarInteractionActive = true;
        radarOverlayDetected = true;
      }
    };

    document.addEventListener(
      'pointerdown',
      handlePointerDown,
      {
        capture: true,
        passive: true,
        signal: lifetime.signal,
      },
    );

    document.addEventListener(
      'focusin',
      handleFocusIn,
      {
        capture: true,
        passive: true,
        signal: lifetime.signal,
      },
    );

    refreshRadarOverlayState();

    radarProtectionInterval = every(
      refreshRadarOverlayState,
      500,
    );
  }

  async function runCurrentChatShortcut(action) {
    try {
      await runChatAction(async () => {
        if (action === 'prefix-check') {
          await applyPrefix(
            null,
            `${preferences.prefixes[0]} `,
          );
        } else if (action === 'prefix-yellow') {
          await applyPrefix(
            null,
            `${preferences.prefixes[1]} `,
          );
        } else if (action === 'delete') {
          await deleteChat(null);
        }
      });
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function configurePreferences() {
    const dialog = document.createElement('dialog');

    dialog.className = 'zapia-manager-settings';
    dialog.dataset.zapiaManagerControl = 'true';
    protectManagedSurface(dialog);

    const title = document.createElement('h2');
    title.textContent = 'Configure emojis and shortcuts';

    const fields = document.createElement('div');
    fields.className = 'zapia-manager-settings-fields';

    const feedback = document.createElement('output');
    feedback.className = 'zapia-manager-settings-feedback';

    const field = (label, value, readonly = false) => {
      const wrapper = document.createElement('label');
      wrapper.textContent = label;

      const input = document.createElement('input');
      input.value = value;
      input.readOnly = readonly;

      wrapper.append(input);
      fields.append(wrapper);

      return input;
    };

    const emojiOne = field(
      'First prefix emoji',
      preferences.prefixes[0],
    );

    const emojiTwo = field(
      'Second prefix emoji',
      preferences.prefixes[1],
    );

    const shortcuts = {};

    for (const action of [
      'prefix-check',
      'prefix-yellow',
      'delete',
    ]) {
      const input = field(
        `Shortcut: ${
          action === 'delete'
            ? 'delete'
            : action === 'prefix-check'
              ? 'first prefix'
              : 'second prefix'
        }`,
        shortcutLabel(preferences.shortcuts[action]),
        true,
      );

      shortcuts[action] = preferences.shortcuts[action];

      input.addEventListener('keydown', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const shortcut = shortcutFromEvent(event);
        const error = shortcutValidationError(shortcut);

        if (error) {
          feedback.textContent = error;
          return;
        }

        shortcuts[action] = shortcut;
        input.value = shortcutLabel(shortcut);
        feedback.textContent = '';
      });
    }

    const includeActivityLabel = document.createElement('label');
    includeActivityLabel.textContent = 'Copy context: include agent activity (tool calls, cards, drafts)';
    const includeActivity = document.createElement('input');
    includeActivity.type = 'checkbox';
    includeActivity.checked = preferences.copy.includeActivity;
    includeActivityLabel.append(includeActivity);
    fields.append(includeActivityLabel);

    const actions = document.createElement('div');
    actions.className = 'zapia-manager-settings-actions';

    const cancel = button(
      'Cancel',
      'Close without saving',
      () => dialog.close(),
    );

    const save = button(
      'Save',
      'Save emojis and shortcuts',
      () => {
        const prefixes = [
          emojiOne.value.trim(),
          emojiTwo.value.trim(),
        ];

        const labels = Object.values(shortcuts).map(shortcutLabel);

        if (
          prefixes.some((emoji) => !emoji || emoji.length > 16)
          || new Set(prefixes).size !== 2
        ) {
          throw new Error('Use two different emojis.');
        }

        if (
          Object.values(shortcuts).some(shortcutValidationError)
          || new Set(labels).size !== labels.length
        ) {
          throw new Error(
            'Use valid shortcuts that differ from one another.',
          );
        }

        savePreferences(
          { ...preferences, prefixes, shortcuts, copy: { includeActivity: includeActivity.checked } },
          window.localStorage,
        );

        dialog.close();
        mountControls();
      },
    );

    if (preferences.hiddenChats?.length) {
      const hiddenSection = document.createElement('div');
      hiddenSection.className = 'zapia-manager-settings-hidden-section';
      const hiddenTitle = document.createElement('h3');
      hiddenTitle.textContent = 'Hidden chats';
      const hiddenList = document.createElement('div');
      hiddenList.className = 'zapia-manager-settings-hidden-list';
      for (const hidden of preferences.hiddenChats) {
        const row = document.createElement('div');
        row.className = 'zapia-manager-settings-hidden-row';
        const label = document.createElement('span');
        label.textContent = hidden.title || hidden.id;
        const restore = button('Restore', 'Make this chat visible in catalogue', () => {
          unhideChat(hidden.id);
          dialog.close();
          configurePreferences();
        });
        row.append(label, restore);
        hiddenList.append(row);
      }
      hiddenSection.append(hiddenTitle, hiddenList);
      dialog.append(hiddenSection);
    }

    actions.append(cancel, save);
    dialog.append(title, fields, feedback, actions);

    dialog.addEventListener(
      'close',
      () => dialog.remove(),
      { once: true },
    );

    document.body.append(dialog);
    dialog.showModal();
  }

  // Accessibility semantics (which this script needs) put full-width transparent
  // buttons over every message, so a real click anywhere on a message acted as a tap
  // on it: opening its link or copying it. Swallowing only those semantic clicks
  // leaves Zapia's own pointer handling, which hits just the link text or the icon.
  // Clicks synthesised by this script are untrusted and keyboard activation has no
  // pointer position, so neither is affected.
  function installMessageClickGuard() {
    document.addEventListener('click', (event) => {
      if (!event.isTrusted || event.target?.tagName !== 'FLT-SEMANTICS' || isRadarOverlayOpen()) return;
      const composerTops = [...document.querySelectorAll('flt-semantics')]
        .filter((node) => semanticLabel(node).startsWith('Adicionar anexo'))
        .map((node) => node.getBoundingClientRect().top);
      // No chat composer means this is not a conversation view (Radar, empty states):
      // every control there is meant to be clicked, so the guard stays out of the way.
      if (!composerTops.length) return;
      const navRight = getChatViewport()?.nav.getBoundingClientRect().right ?? 280;
      if (isChatBodyPoint({
        clientX: event.clientX,
        clientY: event.clientY,
        navRight,
        composerTop: Math.min(...composerTops),
      })) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    }, { capture: true, signal: lifetime.signal });
  }

  function installKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && activeRowMenu) {
        closeRowMenu();
        return;
      }

      if (
        event.defaultPrevented
        || isEditableTarget(event.target)
        || hasFocusedTextEntry()
        || isRadarOverlayOpen()
      ) {
        return;
      }

      const action = currentChatShortcut(event);

      if (!action) return;

      event.preventDefault();
      event.stopPropagation();

      void runCurrentChatShortcut(action);
    }, { signal: lifetime.signal });

    document.addEventListener('pointerdown', (event) => {
      if (activeRowMenu && !activeRowMenu.contains(event.target) && !event.target.closest?.('.zapia-manager-chat-menu')) {
        closeRowMenu();
      }
    }, { signal: lifetime.signal, capture: true });
  }

  const SIDEBAR_SCROLL_STEP = 160;
  const activeFilters = new Set(restoredState?.filters ?? []);
  let knownChats = restoredState?.chats ?? [];
  let chatListVersion = 0;
  let chatScanRunning = false;
  let catalogueComplete = Boolean(restoredState?.complete
    && knownChats.every((chat) => typeof chat.pinned === 'boolean'));
  let chatScanStarted = catalogueComplete;
  let nativeSections = new WeakMap();
  let chatActionDepth = 0;
  let rescanTimer = null;
  let sidebarTopOffset = restoredState?.sidebarTopOffset ?? null;
  let sidebarHomePending = false;
  let activeCatalogueId = restoredState?.activeCatalogueId ?? null;
  let selectionAnchorId = null;

  // Ids of the chats between two rows of the visible list, both included (null if either is
  // not in the list, e.g. after a filter change).
  function chatRangeIds(chats, anchorId, targetId) {
    const from = chats.findIndex((chat) => chat.id === anchorId);
    const to = chats.findIndex((chat) => chat.id === targetId);
    if (from < 0 || to < 0) return null;
    return chats.slice(Math.min(from, to), Math.max(from, to) + 1).map((chat) => chat.id);
  }
  let activeCatalogueUrl = restoredState?.activeCatalogueUrl ?? location.href;
  for (const id of restoredState?.selection ?? []) selectedChatIds.add(id);

  function setKnownChats(next) {
    knownChats = next;
    chatListVersion += 1;
  }

  function pruneSelection() {
    const known = new Set(knownChats.map(({ id }) => id));

    for (const id of [...selectedChatIds]) {
      if (!known.has(id)) selectedChatIds.delete(id);
    }
  }

  function filteredChats() {
    const visibleKnownChats = excludeHiddenChats(knownChats, preferences.hiddenChats)
      .map((chat) => ({
        ...chat,
        unread: unreadCountForTitle(chat.title),
        pending: isReplyPendingForTitle(chat.title),
      }));
    return filterChatsByQuery(
      catalogueView(visibleKnownChats, activeFilters, preferences.prefixes, preferences.view),
      catalogueSearchQuery,
    );
  }

  function nextFrame() {
    assertRuntimeActive();
    return new Promise((resolve, reject) => {
      let settled = false;
      let fallbackId;
      let frameId;
      const finish = () => {
        if (settled) return;
        settled = true;
        pendingWork.delete(cancel);
        window.clearTimeout(fallbackId);
        ownedTimeouts.delete(fallbackId);
        window.cancelAnimationFrame(frameId);
        ownedFrames.delete(frameId);
        resolve();
      };
      const cancel = () => {
        if (settled) return;
        settled = true;
        pendingWork.delete(cancel);
        window.clearTimeout(fallbackId);
        ownedTimeouts.delete(fallbackId);
        window.cancelAnimationFrame(frameId);
        ownedFrames.delete(frameId);
        reject(new DOMException('Userscript instance replaced.', 'AbortError'));
      };
      pendingWork.add(cancel);
      frameId = frame(finish);
      // rAF pauses in a backgrounded Flutter tab. This only releases the
      // liveness wait; scrollSidebar still proves a real semantic change.
      fallbackId = later(finish, 250);
    });
  }

  function captureNativeSections(viewport) {
    if (!viewport) return;
    for (const marker of viewport.nav.querySelectorAll('flt-semantics[role="button"][aria-expanded]')) {
      const label = semanticLabel(marker);
      if (label !== 'Fixados' && label !== 'Conversas') continue;
      const group = marker.parentElement;
      const bounds = nativeSections.get(group) ?? {};
      const rect = marker.getBoundingClientRect();
      const origin = group.getBoundingClientRect().top - group.scrollTop;
      if (label === 'Fixados') bounds.start = rect.bottom - origin;
      else bounds.end = rect.top - origin;
      nativeSections.set(group, bounds);
    }
  }

  function nativeChatRecord(row) {
    const group = row.parentElement;
    const bounds = nativeSections.get(group);
    const position = row.getBoundingClientRect().top - group.getBoundingClientRect().top + group.scrollTop;
    return {
      id: chatIdentity(row), title: chatTitle(row),
      pinned: pinnedBetweenSections(position, bounds?.start, bounds?.end),
    };
  }

  function collectSidebarChats() {
    const viewport = getChatViewport();
    captureNativeSections(viewport);
    return discoverChatRows(viewport, false).map(nativeChatRecord);
  }

  function sidebarSignature() {
    const rows = discoverChatRows();

    if (!rows.length) return '';

    const first = rows[0];
    const last = rows.at(-1);

    return `${chatIdentity(first)}|${
      Math.round(first.getBoundingClientRect().top)
    }|${chatIdentity(last)}|${
      Math.round(last.getBoundingClientRect().top)
    }`;
  }

  async function scrollSidebar(deltaY, timeoutMs = 600) {
    const viewport = getChatViewport();
    const view = document.querySelector('flutter-view');

    if (!viewport || !view) return false;

    const before = sidebarSignature();

    view.dispatchEvent(new WheelEvent('wheel', {
      deltaY,
      clientX: Math.round(viewport.navRect.left + viewport.navRect.width * 0.4),
      clientY: Math.round((viewport.top + viewport.bottom) / 2),
      bubbles: true,
      cancelable: true,
    }));

    const deadline = performance.now() + timeoutMs;

    while (performance.now() < deadline) {
      await nextFrame();

      if (sidebarSignature() !== before) {
        await nextFrame();
        await nextFrame();
        return true;
      }
    }

    return false;
  }

  async function scrollSidebarStep(deltaY) {
    if (await scrollSidebar(deltaY, 800)) return true;

    return scrollSidebar(deltaY, 1800);
  }

  function nativeNavigationAtHome(viewport = getChatViewport()) {
    if (!viewport) return false;
    const first = [...viewport.nav.querySelectorAll('flt-semantics[role="button"]')]
      .find((element) => semanticLabel(element) === 'Novo Chat');
    return Boolean(first && first.getBoundingClientRect().top >= viewport.navRect.top + HEADER_CLIP_TOP);
  }

  async function scrollSidebarToTop() {
    while (!nativeNavigationAtHome()) {
      if (!(await scrollSidebarStep(-SIDEBAR_SCROLL_STEP * 8))) return;
    }
  }

  function visibleChatRowById(id) {
    return discoverChatRows().find(
      (row) => chatIdentity(row) === id,
    ) ?? null;
  }

  async function findChatRow(id) {
    let row = visibleChatRowById(id);

    if (row) return row;

    await scrollSidebarToTop();

    for (;;) {
      row = visibleChatRowById(id);

      if (row) return row;
      if (!(await scrollSidebarStep(SIDEBAR_SCROLL_STEP))) break;
    }

    row = visibleChatRowById(id);

    if (row) return row;

    throw new Error(`Zapia did not render chat ${id}.`);
  }

  async function scanAllChats() {
    if (chatScanRunning || chatActionDepth > 0) return;

    chatScanRunning = true;
    nativeSections = new WeakMap();
    chatListVersion += 1;

    try {

      await scrollSidebarToTop();

      let found = [];

      for (;;) {
        found = mergeChatList(found, collectSidebarChats());

        if (!(await scrollSidebarStep(SIDEBAR_SCROLL_STEP))) break;
      }

      for (;;) {
        found = mergeChatList(found, collectSidebarChats());

        if (!(await scrollSidebarStep(-SIDEBAR_SCROLL_STEP))) break;
      }

      found = mergeChatList(found, collectSidebarChats());

      if (found.length) {
        setKnownChats(found);
        catalogueComplete = true;
        pruneSelection();
      }

      await scrollSidebarToTop();
    } catch (error) {
      if (error.name !== 'AbortError') throw error;
    } finally {
      chatScanRunning = false;
      chatListVersion += 1;
      if (!lifetime.signal.aborted) mountControls();
    }
  }

  function scheduleChatRescan() {
    if (lifetime.signal.aborted) return;
    window.clearTimeout(rescanTimer);

    rescanTimer = later(() => {
      void scanAllChats().catch((error) => toast(error.message, 'error'));
    }, 2500);
  }

  async function runChatAction(task, { refresh = true } = {}) {
    assertRuntimeActive();
    if (chatScanRunning) {
      throw new Error(
        'Wait for the chat list to finish loading.',
      );
    }
    if (chatActionDepth > 0) {
      throw new Error('Wait for the current action to finish.');
    }

    chatActionDepth += 1;
    renderManagerPanel();

    try {
      await task();
    } finally {
      chatActionDepth -= 1;
      if (refresh) scheduleChatRescan();
      renderManagerPanel();
    }
  }

  function queueFromSelection() {
    deletionQueue = knownChats
      .map(({ id }) => id)
      .filter((id) => selectedChatIds.has(id));
  }

  async function applyPrefixToSelectedChats(prefix) {
    queueFromSelection();

    if (!deletionQueue.length) {
      throw new Error('Select at least one chat.');
    }

    await runChatAction(async () => {
      for (const id of [...deletionQueue]) {
        await rediscoverAndApply(id, prefix);
        selectedChatIds.delete(id);
      }
    });

    deletionQueue = [];
    mountControls();
  }

  async function deleteSelectedChats() {
    if (nativeDeleteDialogOpen()) {
      throw new Error(
        'Finish or cancel the native Zapia dialog before deleting another chat.',
      );
    }

    queueFromSelection();

    if (!deletionQueue.length) {
      throw new Error('Select at least one chat.');
    }


    await runChatAction(async () => {
      for (const id of [...deletionQueue]) {
        await rediscoverAndDelete(id);
        selectedChatIds.delete(id);
      }
    });

    deletionQueue = [];
    mountControls();
  }

  function pruneHiddenSelection() {
    const shown = new Set(filteredChats().map(({ id }) => id));

    for (const id of [...selectedChatIds]) {
      if (!shown.has(id)) selectedChatIds.delete(id);
    }
  }

  function toggleFilter(filter) {
    if (activeFilters.has(filter)) {
      activeFilters.delete(filter);
    } else {
      activeFilters.add(filter);
    }

    pruneHiddenSelection();
    renderManagerPanel();
  }

  function hideChat(chatId, chatTitle = '') {
    const current = preferences.hiddenChats ?? [];
    if (current.some((c) => c.id === chatId)) return;
    savePreferences(
      { ...preferences, hiddenChats: [...current, { id: chatId, title: chatTitle || chatId }] },
      window.localStorage,
    );
    selectedChatIds.delete(chatId);
    pruneHiddenSelection();
    renderManagerPanel();
  }

  function unhideChat(chatId) {
    const current = preferences.hiddenChats ?? [];
    savePreferences(
      { ...preferences, hiddenChats: current.filter((c) => c.id !== chatId) },
      window.localStorage,
    );
    renderManagerPanel();
  }

  function recordUnavailableChatFailure(error, chat) {
    const payload = buildSupportDiagnosticPayload(error, {
      id: chat.id,
      title: chat.title,
      url: location.href,
    });
    console.error('[Zapia Manager] Unrecoverable chat diagnostic report for Zapia support:', payload);
    hideChat(chat.id, chat.title);
    toast(
      `Zapia could not delete "${chat.title}". It has been hidden in Zapia Manager and diagnostic details were logged to the console.`,
      'warning',
    );
  }

  async function promptUnavailableChatRecovery(chatId) {
    const chat = knownChats.find((c) => c.id === chatId) ?? { id: chatId, title: chatId };
    const confirmed = window.confirm(
      `Zapia could not load "${chat.title}".\n\nDo you want to try deleting it from Zapia?\n(If Zapia cannot delete this chat, it will be hidden in Zapia Manager and diagnostic details will be logged in the console for Zapia support).`,
    );
    if (!confirmed) return;

    try {
      await runChatAction(async () => {
        const row = await findChatRow(chatId);
        await deleteChat(row);
        toast(`Deleted "${chat.title}".`, 'info');
      }, { refresh: true });
    } catch (deleteError) {
      recordUnavailableChatFailure(deleteError, chat);
    }
  }

  function setViewOption(key, value) {
    savePreferences({ ...preferences, view: { ...preferences.view, [key]: value } }, window.localStorage);
    pruneHiddenSelection();
    renderManagerPanel();
  }

  function togglePanelMinimized() {
    savePreferences(
      { ...preferences, panel: { ...preferences.panel, minimized: !preferences.panel.minimized } },
      window.localStorage,
    );
    renderManagerPanel();
  }

  function openCatalogueSearch() {
    catalogueSearchOpen = true;
    renderManagerPanel();
    queueMicrotask(() => {
      const input = document.querySelector('.zapia-manager-search-input');
      input?.focus();
    });
  }

  function clearCatalogueSearch() {
    catalogueSearchOpen = false;
    catalogueSearchQuery = '';
    pruneHiddenSelection();
    renderManagerPanel();
  }

  function setCatalogueSearchQuery(query) {
    catalogueSearchQuery = query;
    pruneHiddenSelection();
    renderManagerPanel();
    queueMicrotask(() => {
      const input = document.querySelector('.zapia-manager-search-input');
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }

  let activeRowMenu = null;

  function closeRowMenu() {
    if (activeRowMenu) {
      activeRowMenu.remove();
      activeRowMenu = null;
    }
  }

  function openRowMenu(triggerButton, chat) {
    if (activeRowMenu?.dataset.chatId === chat.id) {
      closeRowMenu();
      return;
    }
    closeRowMenu();

    const menu = document.createElement('div');
    menu.className = 'zapia-manager-row-menu';
    menu.dataset.zapiaManagerControl = 'true';
    menu.dataset.chatId = chat.id;
    protectManagedSurface(menu);


    const renameItem = button('Rename', 'Rename chat', async () => {
      closeRowMenu();
      await runChatAction(async () => {
        const row = await findChatRow(chat.id);
        await activateNativeChat(row);
        await openCurrentNativeActions();
        const editAction = await waitFor(
          () => visibleMenuAction(MENU_RENAME_ACTION),
          'the native rename action',
        );
        editAction.click();
      }, { refresh: false });
    });

    const prefix0Item = button(`${preferences.prefixes[0]} Prefix`, `Prefix with ${preferences.prefixes[0]}`, async () => {
      closeRowMenu();
      await runChatAction(async () => {
        await rediscoverAndApply(chat.id, `${preferences.prefixes[0]} `);
      });
    });

    const prefix1Item = button(`${preferences.prefixes[1]} Prefix`, `Prefix with ${preferences.prefixes[1]}`, async () => {
      closeRowMenu();
      await runChatAction(async () => {
        await rediscoverAndApply(chat.id, `${preferences.prefixes[1]} `);
      });
    });

    const deleteItem = button('Delete', 'Delete chat', async () => {
      closeRowMenu();
      assertChatTitle(chat.title);
      await runChatAction(async () => {
        await rediscoverAndDelete(chat.id);
      });
    });
    deleteItem.classList.add('is-danger');

    menu.append(renameItem, prefix0Item, prefix1Item, deleteItem);
    document.body.append(menu);
    activeRowMenu = menu;

    const rect = triggerButton.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const top = Math.min(rect.bottom + 4, window.innerHeight - menuRect.height - 8);
    const left = Math.max(8, rect.right - menuRect.width);

    menu.style.top = `${Math.max(0, top)}px`;
    menu.style.left = `${left}px`;
  }

  async function openCatalogueChat(id) {
    try {
      await runChatAction(async () => {
        try {
          const row = await findChatRow(id);
          await activateNativeChat(row);
        } finally {
          await scrollSidebarToTop();
        }
      }, { refresh: false });
    } catch (error) {
      if (!isUnavailableChatError(error)) throw error;
      await promptUnavailableChatRecovery(id);
    }
  }

  function protectManagedSurface(element) {
    for (const type of ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'mousedown', 'mouseup', 'click', 'wheel']) {
      element.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
    }
  }

  function renderManagerPanel() {
    let panel = document.querySelector('[data-zapia-manager-panel]');
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'zapia-manager-sidebar';
      panel.dataset.zapiaManagerPanel = 'true';
      panel.dataset.zapiaManagerControl = 'true';
      panel.setAttribute('aria-label', 'Chats');
      protectManagedSurface(panel);
      document.body.append(panel);
    }
    syncNativeSidebarLayout();
    const minimized = preferences.panel.minimized;
    panel.classList.toggle('is-minimized', minimized);
    const state = [
      JSON.stringify(preferences),
      catalogueSearchOpen,
      catalogueSearchQuery,
      [...activeFilters].sort().join(','),
      chatScanRunning,
      chatActionDepth > 0,
      chatListVersion,
      activeCatalogueId,
      [...selectedChatIds].join('\u0001'),
      staleThreadIds.join(','),
      copyProgress,
      unreadSignature(),
      pendingSignature(),
    ].join('|');
    if (panel.dataset.zapiaManagerState === state) return;
    const previousScroll = panel.querySelector('.zapia-manager-chat-list')?.scrollTop
      ?? restoredState?.listScroll ?? 0;
    panel.dataset.zapiaManagerState = state;
    panel.replaceChildren();
    const chats = filteredChats();
    const busy = chatScanRunning || chatActionDepth > 0;

    const heading = document.createElement('div');
    heading.className = 'zapia-manager-panel-heading';
    const headingCopy = document.createElement('div');
    headingCopy.className = 'zapia-manager-panel-heading-copy';
    const title = document.createElement('strong');
    title.textContent = 'Chats';
    const summary = document.createElement('span');
    summary.setAttribute('role', 'status');
    summary.textContent = chatScanRunning ? 'Loading…'
      : selectedChatIds.size ? `${selectedChatIds.size} selected`
        : activeFilters.size || preferences.view.onlyUnprefixed || catalogueSearchQuery ? `${chats.length} of ${knownChats.length}` : String(knownChats.length);
    headingCopy.append(title, document.createTextNode(' '), summary);
    const headingActions = document.createElement('div');
    headingActions.className = 'zapia-manager-panel-heading-actions';
    const settings = button('⚙', 'Configure emojis and shortcuts', configurePreferences);
    settings.classList.add('zapia-manager-settings-trigger');
    settings.disabled = busy;
    const minimize = button(
      minimized ? '+' : '-',
      minimized ? 'Expand chat panel' : 'Minimize chat panel',
      togglePanelMinimized,
    );
    minimize.classList.add('zapia-manager-minimize-trigger');
    headingActions.append(settings, minimize);
    heading.append(headingCopy, headingActions);
    panel.append(heading);
    if (minimized) return;

    if (staleThreadIds.length) {
      const notice = document.createElement('div');
      notice.className = 'zapia-manager-stale-notice';
      const message = document.createElement('span');
      message.textContent = `${staleThreadIds.length} chat${staleThreadIds.length === 1 ? '' : 's'} no longer exist${staleThreadIds.length === 1 ? 's' : ''} on Zapia and cannot open.`;
      const clean = button(
        'Clean up',
        'Remove these chats from the Zapia cache stored in this browser',
        purgeStaleThreads,
      );
      clean.disabled = busy;
      notice.append(message, clean);
      panel.append(notice);
    }

    const filters = document.createElement('div');
    filters.className = 'zapia-manager-filters';
    if (catalogueSearchOpen) {
      const input = document.createElement('input');
      input.className = 'zapia-manager-search-input';
      input.dataset.zapiaManagerControl = 'true';
      input.type = 'search';
      input.value = catalogueSearchQuery;
      input.placeholder = 'Search chats';
      input.setAttribute('aria-label', 'Search chats');
      input.disabled = busy;
      input.addEventListener('input', () => setCatalogueSearchQuery(input.value));
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        clearCatalogueSearch();
      });
      filters.append(input);
    } else {
      const unprefixed = button(
        '\u00a0',
        'Show only chats without a prefix while keeping pinned chats',
        () => setViewOption('onlyUnprefixed', !preferences.view.onlyUnprefixed),
      );
      unprefixed.classList.add('zapia-manager-filter', 'zapia-manager-unprefixed-filter');
      unprefixed.classList.toggle('is-active', preferences.view.onlyUnprefixed);
      unprefixed.setAttribute('aria-pressed', String(preferences.view.onlyUnprefixed));
      filters.append(unprefixed);
      for (const [key, label, hint] of [
        ['numbered', '[nº]', 'Show chats with a numeric [id]'],
        ['prefix-0', preferences.prefixes[0], 'Show chats with the first emoji'],
        ['prefix-1', preferences.prefixes[1], 'Show chats with the second emoji'],
        ['unread', '●', 'Show only chats with unread messages'],
      ]) {
        const chip = button(label, hint, () => toggleFilter(key));
        chip.classList.add('zapia-manager-filter');
        if (key === 'unread') chip.classList.add('zapia-manager-unread-filter');
        chip.classList.toggle('is-active', activeFilters.has(key));
        chip.setAttribute('aria-pressed', String(activeFilters.has(key)));
        filters.append(chip);
      }
    }
    const search = button(
      catalogueSearchOpen ? '×' : '🔍',
      catalogueSearchOpen ? 'Clear search' : 'Search chats',
      catalogueSearchOpen ? clearCatalogueSearch : openCatalogueSearch,
    );
    search.classList.add('zapia-manager-search');
    search.classList.toggle('is-clear', catalogueSearchOpen);
    search.disabled = busy;
    const refresh = button('↻', 'Refresh the complete chat list', scanAllChats);
    refresh.classList.add('zapia-manager-refresh');
    refresh.disabled = busy;
    filters.append(search, refresh);
    panel.append(filters);

    const advanced = document.createElement('details');
    advanced.className = 'zapia-manager-view-options';
    advanced.open = panel.dataset.viewOptionsOpen === 'true';
    const advancedTitle = document.createElement('summary');
    advancedTitle.textContent = `Filters and priorities${Object.entries(preferences.view)
      .some(([key, value]) => key !== 'onlyUnprefixed' && value) ? ' • active' : ''}`;
    advanced.append(advancedTitle);
    advanced.addEventListener('toggle', () => { panel.dataset.viewOptionsOpen = String(advanced.open); });
    for (const [key, label] of [
      ['prioritizeAgents', `Prioritize agents and skills (${preferences.prefixes[1]})`],
      ['prioritizeIds', 'Prioritize pending IDs'],
      ['hideCompleted', `Hide completed (${preferences.prefixes[0]})`],
    ]) {
      const field = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.viewOption = key;
      input.checked = preferences.view[key];
      input.disabled = busy || (preferences.view.onlyUnprefixed && key.startsWith('prioritize'));
      input.addEventListener('change', () => setViewOption(key, input.checked));
      field.append(input, document.createTextNode(label));
      advanced.append(field);
    }
    panel.append(advanced);

    const list = document.createElement('div');
    list.className = 'zapia-manager-chat-list';
    if (!chats.length) {
      const empty = document.createElement('span');
      empty.className = 'zapia-manager-empty';
      empty.textContent = chatScanRunning ? 'Loading chats…' : 'No chats found.';
      list.append(empty);
    }
    for (const chat of chats) {
      const option = document.createElement('div');
      option.className = 'zapia-manager-chat-option';
      option.classList.toggle('is-current', chat.id === activeCatalogueId);
      option.dataset.chatId = chat.id;
      option.dataset.pinned = String(chat.pinned);
      const select = document.createElement('input');
      select.type = 'checkbox';
      select.checked = selectedChatIds.has(chat.id);
      select.disabled = busy;
      select.setAttribute('aria-label', `Select ${chat.title}`);
      const selectRange = (checked) => {
        const ids = chatRangeIds(chats, selectionAnchorId, chat.id);
        if (!ids) return false;
        for (const id of ids) {
          if (checked) selectedChatIds.add(id);
          else selectedChatIds.delete(id);
        }
        return true;
      };
      select.addEventListener('click', (event) => {
        const checked = select.checked;
        if (!(event.shiftKey && selectRange(checked))) {
          if (checked) selectedChatIds.add(chat.id);
          else selectedChatIds.delete(chat.id);
          selectionAnchorId = chat.id;
        }
        renderManagerPanel();
      });
      // Shift+click must extend the selection, not select the text of the rows in between.
      option.addEventListener('mousedown', (event) => {
        if (event.shiftKey) event.preventDefault();
      });
      const open = button(chat.title, `Open ${chat.title}`, () => openCatalogueChat(chat.id));
      open.removeAttribute('title');
      open.classList.add('zapia-manager-chat-title');
      open.disabled = busy;
      open.addEventListener('click', (event) => {
        if (!event.shiftKey) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!selectRange(true)) {
          selectedChatIds.add(chat.id);
          selectionAnchorId = chat.id;
        }
        renderManagerPanel();
      }, true);
      if (chat.id === activeCatalogueId) open.setAttribute('aria-current', 'page');
      const menu = button('⋯', `More actions for ${chat.title}`, () => openRowMenu(menu, chat));
      menu.classList.add('zapia-manager-chat-menu');
      menu.disabled = busy;
      option.append(select, open);
      if (chat.pending) {
        const spinner = document.createElement('span');
        spinner.className = 'zapia-manager-pending';
        spinner.textContent = '\u21bb';
        spinner.setAttribute('role', 'img');
        spinner.setAttribute('aria-label', 'Zapia is replying');
        spinner.title = 'Zapia is replying';
        option.append(spinner);
      }
      if (chat.unread > 0) {
        const badge = document.createElement('span');
        badge.className = 'zapia-manager-unread';
        badge.textContent = chat.unread > 99 ? '99+' : String(chat.unread);
        badge.setAttribute('aria-label', `${chat.unread} unread message${chat.unread === 1 ? '' : 's'}`);
        option.append(badge);
      }
      option.append(menu);
      list.append(option);
    }
    panel.append(list);
    list.scrollTop = previousScroll;
    list.addEventListener('scroll', closeRowMenu, { passive: true });

    if (selectedChatIds.size) {
      const actions = document.createElement('div');
      actions.className = 'zapia-manager-panel-actions';
      const prefixOk = button(
        `${preferences.prefixes[0]} Prefix (${shortcutLabel(preferences.shortcuts['prefix-check'])})`,
        'Apply the first prefix to selected chats',
        () => applyPrefixToSelectedChats(`${preferences.prefixes[0]} `),
      );
      const prefixYellow = button(
        `${preferences.prefixes[1]} Prefix (${shortcutLabel(preferences.shortcuts['prefix-yellow'])})`,
        'Apply the second prefix to selected chats',
        () => applyPrefixToSelectedChats(`${preferences.prefixes[1]} `),
      );
      const remove = button(
        `Delete (${shortcutLabel(preferences.shortcuts.delete)})`,
        'Delete selected chats', deleteSelectedChats,
      );
      const clear = button('Clear selection', 'Clear chat selection', () => {
        selectedChatIds.clear();
        selectionAnchorId = null;
        deletionQueue = [];
        renderManagerPanel();
      });
      for (const action of [prefixOk, prefixYellow, remove, clear]) action.disabled = busy;
      remove.disabled = busy || !selectedChatIds.size;
      const copyContext = button(
        copyProgress ? `Copying ${copyProgress}…` : 'Copy context',
        'Copy the title and full conversation of the selected chats to the clipboard',
        copySelectedChatsContext,
      );
      copyContext.classList.add('zapia-manager-copy-context');
      copyContext.disabled = Boolean(copyProgress);
      actions.append(copyContext, prefixOk, prefixYellow, remove, clear);
      panel.append(actions);
    }
  }

  function removeManagerPanel() {
    document.querySelector(
      '[data-zapia-manager-panel]',
    )?.remove();
  }

  async function rediscoverAndApply(id, prefix) {
    await applyPrefix(await findChatRow(id), prefix);
  }

  async function rediscoverAndDelete(id) {
    await deleteChat(await findChatRow(id));
    setKnownChats(withoutChatId(knownChats, id));
    selectedChatIds.delete(id);
    if (activeCatalogueId === id) activeCatalogueId = null;
  }
  function syncNativeSidebarLayout() {
    const panel = document.querySelector('[data-zapia-manager-panel]');
    if (!panel) return;
    const viewport = getChatViewport();
    if (nativeNavigationAtHome(viewport)) {
      sidebarTopOffset = viewport.top - viewport.navRect.top;
    }
    if (activeCatalogueUrl !== location.href) {
      activeCatalogueUrl = location.href;
      if (!chatActionDepth) activeCatalogueId = null;
    }
    const bounds = viewport
      ? sidebarPlacement(viewport.navRect, sidebarTopOffset, viewport.bottom, innerWidth, innerHeight)
      : null;
    const focused = document.activeElement;
    const nativeEntry = focused instanceof Element
      && !focused.closest('[data-zapia-manager-control]')
      && isEditableTarget(focused)
      && viewport
      && focused.getBoundingClientRect().left < viewport.navRect.right;
    const action = visibleMenuAction(MENU_RENAME_ACTION);
    const menuOverlaps = Boolean(bounds && action && rectanglesOverlap(bounds, action.getBoundingClientRect()));
    panel.classList.toggle('is-sidebar-hidden', !bounds || isRadarOverlayOpen() || nativeEntry || menuOverlaps);
    if (bounds) {
      for (const [name, value] of Object.entries({
        left: `${bounds.left}px`, top: `${bounds.top}px`,
        width: `${bounds.width}px`, height: `${bounds.height}px`,
      })) {
        if (panel.style[name] !== value) panel.style[name] = value;
      }
    }
    if (viewport && !preferences.panel.minimized && !nativeNavigationAtHome(viewport) && !nativeEntry && !isRadarOverlayOpen()
      && !sidebarHomePending && !chatScanRunning && !chatActionDepth) {
      void scrollSidebarToTop().catch((error) => toast(error.message, 'error')).finally(() => {
        sidebarHomePending = false;
        if (!lifetime.signal.aborted) syncNativeSidebarLayout();
      });
    }
  }

  function installSidebarWheelGuard() {
    document.addEventListener('wheel', (event) => {
      if (!event.isTrusted || event.target?.closest?.('[data-zapia-manager-control]')) return;
      const panel = document.querySelector('.zapia-manager-sidebar:not(.is-sidebar-hidden):not(.is-minimized)');
      const viewport = getChatViewport();
      if (panel && pointInChatViewport(viewport, event.clientX, event.clientY)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, { capture: true, passive: false, signal: lifetime.signal });
  }

  function mountControls() {
    if (lifetime.signal.aborted) return;
    syncNativeSidebarLayout();

    if (
      hasFocusedTextEntry()
      || isRadarOverlayOpen()
    ) {
      return;
    }

    enableFlutterSemantics();

    const viewport = getChatViewport();
    const rows = discoverChatRows(viewport);
    const hoverActionOpen = hasChatHoverAction(viewport);
    captureNativeSections(viewport);

    if (!shouldShowChatManager(rows) && !knownChats.length) {
      if (!hoverActionOpen) {
        removeManagerPanel();
      }

      return;
    }

    if (hoverActionOpen) {
      if (knownChats.length) renderManagerPanel();
      return;
    }

    if (!chatScanRunning) {
      const merged = mergeChatList(
        knownChats,
        rows.map(nativeChatRecord).filter(isOnServer),
      );

      if (merged.length !== knownChats.length
        || merged.some((chat, index) => chat.pinned !== knownChats[index]?.pinned)) {
        setKnownChats(merged);
      }
    }

    if (!chatScanStarted && rows.length && chatActionDepth === 0) {
      chatScanStarted = true;
      void scanAllChats().catch((error) => toast(error.message, 'error'));
    }

    renderManagerPanel();
  }

  function scheduleMount() {
    if (observerScheduled) return;

    observerScheduled = true;

    queueMicrotask(() => {
      observerScheduled = false;
      mountControls();
    });
  }

  function installStyles() {
    const style = document.createElement('style');
    style.dataset.zapiaManagerStyle = 'true';
    style.textContent = `
      .zapia-manager-sidebar {
        position: fixed; z-index: 2147483647 !important; box-sizing: border-box;
        display: flex; flex-direction: column; overflow: hidden;
        left: 0; top: 0; width: 280px; max-height: calc(100vh - 80px);
        border: 0; border-right: 1px solid #272929; border-radius: 0;
        background: #181919; color: #f2f3f3;
        font: 13px/1.35 Inter, system-ui, sans-serif; pointer-events: auto !important;
      }
      .zapia-manager-sidebar.is-sidebar-hidden { visibility: hidden; pointer-events: none !important; }
      .zapia-manager-sidebar.is-minimized { height: auto !important; overflow: visible; border: 0; border-right: 1px solid transparent; background: transparent; pointer-events: none !important; }
      .zapia-manager-sidebar.is-minimized .zapia-manager-panel-heading { justify-content: flex-end; }
      .zapia-manager-sidebar.is-minimized .zapia-manager-panel-heading-copy,
      .zapia-manager-sidebar.is-minimized .zapia-manager-settings-trigger { display: none; }
      .zapia-manager-sidebar.is-minimized .zapia-manager-panel-heading-actions,
      .zapia-manager-sidebar.is-minimized .zapia-manager-minimize-trigger { pointer-events: auto !important; }
      .zapia-manager-panel-heading-copy { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
      .zapia-manager-panel-heading-copy strong { font-size: 13px; font-weight: 600; color: #f2f3f3; }
      .zapia-manager-panel-heading-copy span { font-size: 11px; color: #a4abaa; }
      .zapia-manager-panel-heading { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 2px 22px 14px 12px; min-block-size: 32px; }
      .zapia-manager-filters { flex: 0 0 auto; display: flex; gap: 6px; padding: 0 12px 8px; border-bottom: 1px solid #292b2b; }
      .zapia-manager-button { border: 1px solid #373b3b; border-radius: 6px; background: transparent; color: inherit; cursor: pointer; font: inherit; min-block-size: 28px; padding: 4px 7px; pointer-events: auto !important; }
      .zapia-manager-button:hover:not(:disabled) { background: #2a2e2e; }
      .zapia-manager-button:focus-visible { outline: 2px solid #32bfa6; outline-offset: 2px; }
      .zapia-manager-button:disabled { opacity: .45; cursor: default; }
      .zapia-manager-settings-trigger, .zapia-manager-minimize-trigger { border: 0; font-size: 13px; color: #b3baba; padding: 0; min-block-size: 22px; line-height: 1; }
      .zapia-manager-minimize-trigger { display: inline-flex; align-items: center; justify-content: center; inline-size: 24px; block-size: 24px; }
      .zapia-manager-settings-trigger { padding: 2px 4px; }
      .zapia-manager-filter { min-inline-size: 32px; font-size: 12px; min-block-size: 26px; }
      .zapia-manager-filter.is-active { background: #24443d; border-color: #34a38d; }
      .zapia-manager-search { margin-inline-start: auto; min-block-size: 26px; min-inline-size: 28px; }
      .zapia-manager-search.is-clear { margin-inline-start: 0; }
      .zapia-manager-search-input { box-sizing: border-box; flex: 1 1 auto; min-inline-size: 0; border: 1px solid #454d4b; border-radius: 6px; background: #242828; color: inherit; font: inherit; padding: 4px 7px; }
      .zapia-manager-search-input:focus-visible { outline: 2px solid #32bfa6; outline-offset: 1px; }
      .zapia-manager-refresh { min-block-size: 26px; min-inline-size: 28px; }
      .zapia-manager-view-options { flex: 0 0 auto; padding: 0 12px 4px; border-bottom: 1px solid #292b2b; font-size: 11px; color: #cbd4dc; }
      .zapia-manager-view-options summary { cursor: pointer; padding: 4px 0; color: #b3baba; user-select: none; }
      .zapia-manager-view-options label { display: flex; align-items: center; gap: 7px; padding: 3px 0; line-height: 1.3; }
      .zapia-manager-view-options label:has(input:disabled) { opacity: .5; }
      .zapia-manager-view-options input { flex: 0 0 auto; inline-size: 14px; block-size: 14px; margin: 0; accent-color: #32bfa6; }
      .zapia-manager-chat-list { flex: 1 1 auto; min-block-size: 0; overflow: auto; overscroll-behavior: contain; padding: 4px 6px 8px; scrollbar-width: thin; scrollbar-color: #4e5553 transparent; }
      .zapia-manager-chat-option { display: flex; align-items: center; gap: 7px; padding: 2px 6px; min-inline-size: 0; border-radius: 7px; user-select: text; }
      .zapia-manager-chat-option:hover, .zapia-manager-chat-option.is-current { background: #2a2e2e; }
      .zapia-manager-chat-option input { flex: 0 0 auto; inline-size: 14px; block-size: 14px; margin: 0; accent-color: #32bfa6; }
      .zapia-manager-chat-title { flex: 1 1 auto; min-inline-size: 0; text-align: left; border: 0; padding: 8px 0; overflow-wrap: anywhere; user-select: text; font-size: 12px; line-height: 1.4; }
      .zapia-manager-chat-title:hover:not(:disabled) { background: transparent; }
      .zapia-manager-unread { flex: 0 0 auto; min-inline-size: 18px; padding: 0 6px; border-radius: 9px; background: #1f8f7a; color: #e9fffa; font-size: 11px; font-weight: 700; line-height: 18px; text-align: center; box-sizing: border-box; }
      .zapia-manager-unread-filter { color: #2fb59b; }
      .zapia-manager-pending { flex: 0 0 auto; inline-size: 18px; text-align: center; font-size: 15px; line-height: 18px; color: #8fa3b3; animation: zapia-manager-spin 1.4s linear infinite; }
      @keyframes zapia-manager-spin { to { transform: rotate(360deg); } }
      .zapia-manager-chat-menu { flex: 0 0 auto; border: 0; padding: 0 2px; min-inline-size: 20px; opacity: 0; }
      .zapia-manager-chat-option:hover .zapia-manager-chat-menu, .zapia-manager-chat-option:focus-within .zapia-manager-chat-menu { opacity: 1; }
      .zapia-manager-row-menu {
        position: fixed; z-index: 2147483647; display: flex; flex-direction: column;
        min-inline-size: 148px; background: #1e2020; border: 1px solid #373b3b;
        border-radius: 8px; box-shadow: 0 8px 24px #000a; padding: 4px; gap: 2px;
        font: 13px/1.35 Inter, system-ui, sans-serif; pointer-events: auto !important;
      }
      .zapia-manager-row-menu button {
        display: flex; align-items: center; justify-content: flex-start;
        inline-size: 100%; border: 0; border-radius: 5px; background: transparent;
        color: #f2f3f3; padding: 6px 10px; font-size: 12px; text-align: left;
        cursor: pointer; min-block-size: 26px;
      }
      .zapia-manager-row-menu button:hover:not(:disabled) { background: #2a2e2e; }
      .zapia-manager-row-menu button:disabled { opacity: .45; cursor: default; }
      .zapia-manager-row-menu button.is-danger { color: #f28b82; }
      .zapia-manager-row-menu button.is-danger:hover:not(:disabled) { background: #4a2222; }
      .zapia-manager-empty { display: block; padding: 12px 8px; color: #a4abaa; }
      .zapia-manager-panel-actions { flex: 0 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 5px; padding: 8px; border-top: 1px solid #292b2b; font-size: 11px; }
      .zapia-manager-settings { z-index: 2147483647; inline-size: min(360px, calc(100vw - 32px)); border: 1px solid #454d4b; border-radius: 10px; background: #181919; color: #f2f3f3; box-shadow: 0 16px 40px #0008; font: 14px/1.35 Inter, system-ui, sans-serif; }
      .zapia-manager-settings::backdrop { background: #0009; }
      .zapia-manager-settings h2 { margin: 0 0 12px; font-size: 16px; }
      .zapia-manager-settings-fields { display: grid; gap: 10px; }
      .zapia-manager-settings label { display: grid; gap: 4px; color: #cbd4dc; font-size: 12px; }
      .zapia-manager-settings input { box-sizing: border-box; inline-size: 100%; border: 1px solid #454d4b; border-radius: 5px; background: #242828; color: #f2f3f3; font: inherit; padding: 7px; }
      .zapia-manager-settings-feedback { display: block; min-block-size: 18px; margin-top: 8px; color: #f0b65a; font-size: 12px; }
      .zapia-manager-settings-actions { display: flex; justify-content: flex-end; gap: 7px; margin-top: 14px; }
      .zapia-manager-settings-hidden-section { margin-top: 14px; padding-top: 10px; border-top: 1px solid #373b3b; }
      .zapia-manager-settings-hidden-section h3 { margin: 0 0 8px; font-size: 13px; color: #f0b65a; }
      .zapia-manager-settings-hidden-list { display: grid; gap: 6px; max-block-size: 140px; overflow: auto; }
      .zapia-manager-settings-hidden-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; padding: 3px 0; border-bottom: 1px dashed #2a2e2e; }
      .zapia-manager-settings-hidden-row span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-inline-size: 200px; }
      .zapia-manager-toast { position: fixed; z-index: 2147483647 !important; right: 16px; bottom: 16px; max-inline-size: min(420px, calc(100vw - 32px)); padding: 10px; border-radius: 6px; background: #222; color: #fff; font: 14px system-ui, sans-serif; pointer-events: auto !important; }
      .zapia-manager-toast-error { background: #9f1d1d; }
      .zapia-manager-toast-warning { background: #7b5600; }
      .zapia-manager-stale-notice { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-size: 11px; background: #3a2e12; color: #f0d9a0; border-bottom: 1px solid #292b2b; }
      .zapia-manager-stale-notice span { flex: 1; min-width: 0; }
      .zapia-manager-copy-context { grid-column: 1 / -1; }
      .zapia-manager-settings input[type="checkbox"] { inline-size: auto; justify-self: start; }
      .zapia-manager-context-dialog { inline-size: min(640px, calc(100vw - 32px)); }
      .zapia-manager-context-text { box-sizing: border-box; inline-size: 100%; block-size: min(50vh, 320px); border: 1px solid #454d4b; border-radius: 5px; background: #242828; color: #f2f3f3; font: 12px/1.4 ui-monospace, monospace; padding: 8px; resize: none; }
    `;
    document.head.append(style);
  }

  const THREAD_CACHE_DB = 'basechatsbox';
  const THREAD_CACHE_STORE = 'box';
  const STALE_BACKUP_KEY = 'zapia_manager_stale_thread_backup_v1';
  const threadPages = new Map();
  let unreadByThreadId = new Map();
  let titleIndexCache = null;
  let staleThreadIds = [];
  let staleCheckScheduled = false;
  let routeThreadId = null;
  const REPLY_STATUS_DB = 'threadreplystatusbox';
  let pendingThreadIds = new Set();
  let pendingTitleKeys = new Set();
  let threadsVersion = 0;
  let reconciledKey = '';
  let serverKeysCache = { version: -1, keys: null };
  let untitledRefreshes = 0;
  let lastUntitledRefresh = 0;
  let replyStatusWarned = false;

  // received: [{ id, unread }]. A complete has_unread=true list names every unread
  // thread, so anything absent from it is read. The chat that is open counts as read.
  function mergeUnreadCounts(current, received, { complete = false, openId = null } = {}) {
    const next = new Map(current);
    if (complete) {
      for (const id of next.keys()) next.set(id, 0);
    }
    for (const { id, unread } of received) next.set(id, unread);
    if (openId && next.has(openId)) next.set(openId, 0);
    return next;
  }

  function syncOpenThreadRead() {
    const id = new URL(location.href).searchParams.get('pulsusNumber');
    if (!id || id === routeThreadId) return;
    routeThreadId = id;
    if ((unreadByThreadId.get(id) ?? 0) > 0) {
      unreadByThreadId = mergeUnreadCounts(unreadByThreadId, [], { openId: id });
      renderManagerPanel();
    }
  }
  const SESSION_PARAMS = ['contact_number', 'device_id', 'user_email', 'auth_token'];
  let apiSession = null;
  let copyProgress = '';

  function requestUrl(input) {
    try {
      const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
      return new URL(raw, location.href);
    } catch {
      return null;
    }
  }

  // Keeps the session parameters Zapia itself sends, so the copy action can read
  // the user's own chats through the same API with the same credentials.
  function captureApiSession(input) {
    const url = requestUrl(input);
    if (!url?.pathname.startsWith('/api/v1/')) return;
    const params = {};
    for (const name of SESSION_PARAMS) {
      const value = url.searchParams.get(name);
      if (!value) return;
      params[name] = value;
    }
    apiSession = { origin: url.origin, params };
  }

  function threadsPageRequest(input) {
    const url = requestUrl(input);
    if (!url || !/\/api\/v1\/threads$/u.test(url.pathname)) return null;
    for (const name of url.searchParams.keys()) {
      if (!THREAD_LIST_PARAMS.has(name)) return null;
    }
    // The has_unread=true list is a subset: it refreshes unread counts, never the page chain.
    const unreadFlag = url.searchParams.get('has_unread');
    if (unreadFlag !== null && unreadFlag !== 'true') return null;
    return { before: url.searchParams.get('before'), unreadOnly: unreadFlag === 'true' };
  }

  function recordThreadsPage(request, body) {
    if (!body || !Array.isArray(body.threads)) return;
    const received = [...(body.threads_pinned ?? []), ...body.threads]
      .filter((thread) => typeof thread?.id === 'string');
    unreadByThreadId = mergeUnreadCounts(
      unreadByThreadId,
      received.map((thread) => ({
        id: thread.id,
        unread: Number.isFinite(thread.unread_count) ? thread.unread_count : 0,
      })),
      {
        complete: request.unreadOnly && body.has_more !== true,
        openId: new URL(location.href).searchParams.get('pulsusNumber'),
      },
    );
    if (!request.unreadOnly) {
      threadPages.set(request.before, {
        before: request.before,
        nextCursor: body.next_cursor ?? null,
        hasMore: body.has_more === true,
        threads: received.map((thread) => ({
          id: thread.id,
          label: typeof thread.label === 'string' ? thread.label : '',
          pinned: (body.threads_pinned ?? []).some((pinned) => pinned?.id === thread.id),
          createdAt: typeof thread.created_at === 'string' ? thread.created_at : '',
        })),
      });
      titleIndexCache = null;
      threadsVersion += 1;
    }
    scheduleStaleCheck();
  }

  function unreadSignature() {
    return [...unreadByThreadId].filter(([, count]) => count > 0)
      .map(([id, count]) => `${id}:${count}`).join(',');
  }

  function pendingSignature() {
    return `${[...pendingThreadIds].sort().join(',')}|${[...pendingTitleKeys].sort().join(',')}`;
  }

  // Zapia keeps one record per thread whose answer it is still waiting for, e.g.
  // {"status":"pending","statusText":"Analisando",...}, possibly JSON-encoded twice.
  function parseReplyStatus(value) {
    try {
      let parsed = value;
      for (let pass = 0; pass < 2 && typeof parsed === 'string'; pass += 1) parsed = JSON.parse(parsed);
      return parsed?.status === 'pending';
    } catch {
      return false;
    }
  }

  async function readPendingThreadIds() {
    const db = await openThreadCache(REPLY_STATUS_DB);
    try {
      const store = db.transaction(THREAD_CACHE_STORE, 'readonly').objectStore(THREAD_CACHE_STORE);
      const [keys, values] = await Promise.all([idbRequest(store.getAllKeys()), idbRequest(store.getAll())]);
      return new Set(keys.filter((key, index) => parseReplyStatus(values[index])));
    } finally {
      db.close();
    }
  }

  let lastThreadListRefresh = 0;

  function isKnownThreadId(id) {
    for (const page of threadPages.values()) {
      if (page.threads.some((thread) => thread.id === id)) return true;
    }
    return false;
  }

  // Follows the paginated thread list from the first page to its end. Our own requests go
  // through the observer like Zapia's, so the observed page chain becomes complete.
  async function fetchThreadChain() {
    let before = null;
    for (let page = 0; page < 20; page += 1) {
      const url = new URL('/api/v1/threads', apiSession.origin);
      for (const [name, value] of Object.entries(apiSession.params)) url.searchParams.set(name, value);
      url.searchParams.set('limit', '50');
      if (before) url.searchParams.set('before', before);
      const response = await fetch(url, { signal: lifetime.signal });
      if (!response.ok) return;
      const body = await response.json();
      if (!body.has_more || !body.next_cursor) return;
      before = body.next_cursor;
    }
  }

  let chainAttempts = 0;

  // At most three tries in a row, so a list that never completes cannot cause endless polling.
  function requestThreadChain() {
    if (lifetime.signal.aborted || !apiSession || chainAttempts >= 3
      || Date.now() - lastThreadListRefresh <= 5000) return Promise.resolve();
    chainAttempts += 1;
    lastThreadListRefresh = Date.now();
    return fetchThreadChain().catch(() => {});
  }

  const retainedTitles = new Set();

  // The server list is the truth for which chats exist and what they are called. A chat that
  // was just created or renamed (Zapia names it after its first message) would otherwise
  // keep its old title in the panel next to the new one until the next full sidebar scan.
  // Server threads in list order -> catalogue entries. Existing entries are reused by title so
  // their identity is stable; new or renamed chats get an entry named after the server label.
  function reconcileChatList(chats, serverThreads) {
    const existing = new Map(chats.map((chat) => [matchKey(chat.title), chat]));
    const used = new Set();
    const next = [];
    for (const thread of serverThreads) {
      if (!thread.label) continue;
      const key = matchKey(thread.label);
      if (used.has(key)) continue;
      used.add(key);
      const chat = existing.get(key);
      next.push(chat
        ? (chat.pinned === thread.pinned ? chat : { ...chat, pinned: thread.pinned })
        : { id: `text:${thread.label}`, title: thread.label, pinned: thread.pinned });
    }
    const dropped = chats.filter((chat) => !used.has(matchKey(chat.title)));
    return { next, dropped };
  }

  // Labels of every server thread, or null while the list is incomplete or a brand-new chat
  // still has no title (Zapia names it ~15 s after the first message).
  function serverLabelKeys() {
    if (serverKeysCache.version === threadsVersion) return serverKeysCache.keys;
    const server = threadListFromPages([...threadPages.values()]);
    const threads = server ? [...server.values()] : [];
    // Only a chat created within the last minutes counts as "about to get a title".
    const waiting = threads.some((thread) => !thread.label && Date.now() - Date.parse(thread.createdAt) < 180000);
    const keys = server && threads.length && !waiting
      ? new Set(threads.filter((thread) => thread.label).map((thread) => matchKey(thread.label)))
      : null;
    serverKeysCache = { version: threadsVersion, keys };
    return keys;
  }

  // Native rows can lag behind the server (the sidebar keeps the first-message title for a
  // couple of seconds after the rename) and Flutter recycles nodes, so once the whole server
  // list is known only rows it knows are allowed into the catalogue.
  function isOnServer(chat) {
    const keys = serverLabelKeys();
    return !keys || keys.has(matchKey(chat.title));
  }

  function reconcileCatalogue() {
    if (chatScanRunning || chatActionDepth > 0 || !knownChats.length) return;
    // Zapia delivers the generated title without refetching the list, so ask for it ourselves
    // while a new chat is untitled (every 4 s, at most 40 times).
    if (threadListFromPages([...threadPages.values()]) && !serverLabelKeys()) {
      if (apiSession && untitledRefreshes < 40 && Date.now() - lastUntitledRefresh >= 4000) {
        untitledRefreshes += 1;
        lastUntitledRefresh = Date.now();
        void fetchThreadChain().catch(() => {});
      }
    } else {
      untitledRefreshes = 0;
    }
    const key = `${chatListVersion}:${threadsVersion}`;
    if (key === reconciledKey) return;
    const server = threadListFromPages([...threadPages.values()]);
    if (!server) return;
    chainAttempts = 0;
    reconciledKey = key;
    if (!serverLabelKeys()) return;

    const { next, dropped } = reconcileChatList(knownChats, server.values());
    const signature = (list) => list.map((chat) => `${chat.id}|${chat.pinned}`).join('\n');
    if (!next.length || signature(next) === signature(knownChats)) return;

    for (const chat of dropped) retainedTitles.add(chat.title);
    setKnownChats(next);
    reconciledKey = `${chatListVersion}:${threadsVersion}`;
    pruneSelection();
    if (activeCatalogueId && !next.some((chat) => chat.id === activeCatalogueId)) activeCatalogueId = null;
    renderManagerPanel();
  }

  function labelForThreadId(id) {
    for (const page of threadPages.values()) {
      const thread = page.threads.find((candidate) => candidate.id === id);
      if (thread?.label) return thread.label;
    }
    return null;
  }

  // A chat without a server title yet (just created) is matched through its cache record,
  // which holds the title the sidebar is drawing.
  async function titleKeysForUnlabeled(ids) {
    const unlabeled = ids.filter((id) => !labelForThreadId(id));
    if (!unlabeled.length) return new Set();
    try {
      const found = await staleThreadTitles(unlabeled);
      return new Set(found.filter(({ title }) => title).map(({ title }) => matchKey(title)));
    } catch {
      return new Set();
    }
  }

  async function refreshPendingReplies() {
    let next;
    try {
      next = await readPendingThreadIds();
    } catch (error) {
      if (!replyStatusWarned) {
        replyStatusWarned = true;
        console.warn('[Zapia Manager] could not read pending replies:', error);
      }
      return;
    }
    if (!lifetime.signal.aborted && [...next].some((id) => !isKnownThreadId(id))) {
      void requestThreadChain();
    }
    const titles = await titleKeysForUnlabeled([...next]);
    const signature = `${[...next].sort().join(',')}|${[...titles].sort().join(',')}`;
    if (lifetime.signal.aborted || signature === pendingSignature()) return;
    pendingThreadIds = next;
    pendingTitleKeys = titles;
    renderManagerPanel();
  }

  function isReplyPendingForTitle(title) {
    if (pendingTitleKeys.has(matchKey(title))) return true;
    return pendingThreadIds.size > 0
      && threadIdsForTitle(title).some((id) => pendingThreadIds.has(id));
  }

  // Observation only: Zapia receives the original promise untouched, and our
  // read of a cloned response can never affect its own request.
  function installThreadListObserver() {
    const originalFetch = window.fetch;
    if (typeof originalFetch !== 'function') return;
    const observedFetch = function fetch(...args) {
      const promise = originalFetch.apply(this, args);
      captureApiSession(args[0]);
      const request = threadsPageRequest(args[0]);
      if (request) {
        promise
          .then((response) => (response.ok ? response.clone().json() : null))
          .then((body) => recordThreadsPage(request, body))
          .catch(() => {});
      }
      return promise;
    };
    window.fetch = observedFetch;
    lifetime.signal.addEventListener('abort', () => {
      if (window.fetch === observedFetch) window.fetch = originalFetch;
    }, { once: true });
  }

  function idbRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Never creates the database: opening a missing one aborts its upgrade.
  function openThreadCache(name = THREAD_CACHE_DB) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onupgradeneeded = () => request.transaction.abort();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (db.objectStoreNames.contains(THREAD_CACHE_STORE)) {
          resolve(db);
        } else {
          db.close();
          reject(new Error('Zapia thread cache store not found.'));
        }
      };
    });
  }

  async function readThreadCacheKeys() {
    const db = await openThreadCache();
    try {
      return await idbRequest(
        db.transaction(THREAD_CACHE_STORE, 'readonly').objectStore(THREAD_CACHE_STORE).getAllKeys(),
      );
    } finally {
      db.close();
    }
  }

  function scheduleStaleCheck() {
    if (staleCheckScheduled) return;
    staleCheckScheduled = true;
    later(() => {
      staleCheckScheduled = false;
      const incomplete = !threadListFromPages([...threadPages.values()]);
      (incomplete ? requestThreadChain() : Promise.resolve())
        .then(() => refreshStaleThreads())
        .catch((error) => {
          console.warn('[Zapia Manager] stale chat check failed:', error);
        })
        .finally(() => {
          if (lifetime.signal.aborted) return;
          reconcileCatalogue();
          if (knownChats.length) renderManagerPanel();
        });
    }, 1000);
  }

  async function refreshStaleThreads() {
    const server = threadListFromPages([...threadPages.values()]);
    const ids = server
      ? findStaleThreadIds(await readThreadCacheKeys(), new Set(server.keys()))
      : [];
    if (lifetime.signal.aborted || ids.join() === staleThreadIds.join()) return;
    staleThreadIds = ids;
    renderManagerPanel();
  }

  function bytesToBase64(value) {
    const bytes = value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }

  // Backs the raw entries up to localStorage first; nothing is deleted if that fails.
  async function removeStaleThreadsFromCache(ids) {
    const db = await openThreadCache();
    try {
      const store = (mode) => db.transaction(THREAD_CACHE_STORE, mode).objectStore(THREAD_CACHE_STORE);
      const entries = [];
      for (const id of ids) {
        const value = await idbRequest(store('readonly').get(id));
        if (value === undefined) continue;
        if (!(value instanceof ArrayBuffer || ArrayBuffer.isView(value))) {
          throw new Error(`Unexpected Zapia cache entry format for ${id}.`);
        }
        entries.push({ id, base64: bytesToBase64(value) });
      }
      window.localStorage.setItem(
        STALE_BACKUP_KEY,
        JSON.stringify({ savedAt: new Date().toISOString(), entries }),
      );
      await new Promise((resolve, reject) => {
        const tx = db.transaction(THREAD_CACHE_STORE, 'readwrite');
        const os = tx.objectStore(THREAD_CACHE_STORE);
        for (const id of ids) os.delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  // The sidebar draws chat titles from the same cache record, so the title of a stale chat
  // appears as text inside its raw bytes. The longest known title found there wins.
  function titleFromCacheText(text, titles) {
    let best = null;
    for (const title of titles) {
      if (title && title.length >= 2 && text.includes(title) && (!best || title.length > best.length)) best = title;
    }
    return best;
  }

  async function staleThreadTitles(ids) {
    const db = await openThreadCache();
    try {
      const store = db.transaction(THREAD_CACHE_STORE, 'readonly').objectStore(THREAD_CACHE_STORE);
      const known = [...knownChats.map((chat) => chat.title), ...retainedTitles];
      const decoder = new TextDecoder('utf-8');
      const found = [];
      for (const id of ids) {
        const value = await idbRequest(store.get(id));
        const bytes = value instanceof ArrayBuffer
          ? new Uint8Array(value)
          : ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : null;
        found.push({ id, title: bytes ? titleFromCacheText(decoder.decode(bytes), known) : null });
      }
      return found;
    } finally {
      db.close();
    }
  }

  async function purgeStaleThreads() {
    const server = threadListFromPages([...threadPages.values()]);
    if (!server || !staleThreadIds.length || chatActionDepth > 0) return;
    const ids = [...staleThreadIds];
    const resolved = await staleThreadTitles(ids).catch(() => ids.map((id) => ({ id, title: null })));
    const lines = resolved.map(({ id, title }) => `\u2022 ${title ?? `(title not found, id ${id.slice(-8)})`}`);
    const listed = `\n\n${lines.slice(0, 12).join('\n')}${lines.length > 12 ? `\n\u2026 and ${lines.length - 12} more` : ''}`;

    if (!window.confirm(
      `${ids.length} chat${ids.length === 1 ? ' is' : 's are'} still listed by Zapia but ${ids.length === 1 ? 'does' : 'do'} not exist on its servers, so ${ids.length === 1 ? 'it' : 'they'} cannot open or be deleted.${listed}\n\nRemove ${ids.length === 1 ? 'it' : 'them'} from the Zapia cache stored in this browser? A backup is kept in this browser's local storage and the page will reload.`,
    )) return;

    try {
      await removeStaleThreadsFromCache(ids);
    } catch (error) {
      toast(`Could not clean the Zapia cache: ${error.message}`, 'error');
      return;
    }
    window.location.reload();
  }

  function titleIndex() {
    if (titleIndexCache) return titleIndexCache;
    const exact = new Map();
    const bare = new Map();
    const add = (map, key, id) => {
      const ids = map.get(key);
      if (!ids) map.set(key, [id]);
      else if (!ids.includes(id)) ids.push(id);
    };
    for (const page of threadPages.values()) {
      for (const thread of page.threads) {
        add(exact, matchKey(thread.label), thread.id);
        add(bare, matchKey(stripManagedPrefix(thread.label)), thread.id);
      }
    }
    titleIndexCache = { exact, bare };
    return titleIndexCache;
  }

  function threadIdsForTitle(title) {
    const index = titleIndex();
    const exactIds = index.exact.get(matchKey(title));
    if (exactIds) return exactIds;
    // A prefix applied here is not in the observed server label until Zapia reloads it.
    const bareIds = index.bare.get(matchKey(stripManagedPrefix(title)));
    return bareIds?.length === 1 ? bareIds : [];
  }

  function unreadCountForTitle(title) {
    return threadIdsForTitle(title).reduce((sum, id) => sum + (unreadByThreadId.get(id) ?? 0), 0);
  }

  async function fetchThreadMessages(threadId) {
    const pages = [];
    const seen = new Set();
    let before = null;

    for (;;) {
      const url = new URL(`/api/v1/threads/${encodeURI(threadId)}/messages`, apiSession.origin);
      for (const [name, value] of Object.entries(apiSession.params)) url.searchParams.set(name, value);
      url.searchParams.set('limit', '100');
      if (before) url.searchParams.set('before', before);

      const response = await fetch(url, { signal: lifetime.signal });
      if (response.status === 401 || response.status === 403) {
        apiSession = null;
        throw new Error('Zapia rejected the saved session. Open any chat once and try again.');
      }
      if (!response.ok) throw new Error(`Zapia answered ${response.status} for a selected chat.`);

      const page = await response.json();
      pages.push(Array.isArray(page.messages) ? page.messages : []);
      if (!page.has_more || !page.next_cursor) break;
      if (seen.has(page.next_cursor)) throw new Error('Zapia returned a repeating message cursor.');
      seen.add(page.next_cursor);
      before = page.next_cursor;
    }

    return mergeMessagePages(pages);
  }

  function showContextDialog(text) {
    const dialog = document.createElement('dialog');
    dialog.className = 'zapia-manager-settings zapia-manager-context-dialog';
    dialog.dataset.zapiaManagerControl = 'true';
    protectManagedSurface(dialog);

    const heading = document.createElement('h2');
    heading.textContent = 'Chat context ready';
    const area = document.createElement('textarea');
    area.className = 'zapia-manager-context-text';
    area.readOnly = true;
    area.value = text;
    const actions = document.createElement('div');
    actions.className = 'zapia-manager-settings-actions';
    const copy = button('Copy', 'Copy the context to the clipboard', async () => {
      await navigator.clipboard.writeText(text);
      toast('Copied to the clipboard.');
    });
    const close = button('Close', 'Close this window', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    actions.append(close, copy);
    dialog.append(heading, area, actions);
    document.body.append(dialog);
    dialog.showModal();
    area.select();
  }

  async function copySelectedChatsContext() {
    const chats = selectedChats(knownChats, selectedChatIds);
    if (copyProgress || !chats.length) return;
    if (!apiSession) throw new Error('Zapia has not made a request yet. Open any chat and try again.');

    const sections = [];
    const missing = [];
    let messageCount = 0;

    try {
      for (const [index, chat] of chats.entries()) {
        copyProgress = `${index + 1}/${chats.length}`;
        renderManagerPanel();
        const threadIds = threadIdsForTitle(chat.title);
        if (!threadIds.length) {
          missing.push(chat.title);
          continue;
        }
        for (const threadId of threadIds) {
          const context = formatChatContext(
            chat.title,
            await fetchThreadMessages(threadId),
            preferences.copy.includeActivity,
          );
          sections.push(context.text);
          messageCount += context.count;
        }
      }
    } finally {
      copyProgress = '';
      renderManagerPanel();
    }

    if (!sections.length) throw new Error('None of the selected chats were found in the Zapia chat list.');
    const text = sections.join('\n\n---\n\n');
    let copied = true;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      copied = false;
      showContextDialog(text);
    }
    const skipped = missing.length ? ` Not found in Zapia: ${missing.join(', ')}.` : '';
    toast(
      `${copied ? 'Copied' : 'Prepared'} ${sections.length} chat${sections.length === 1 ? '' : 's'}, ${messageCount} messages.${skipped}`,
      missing.length ? 'warning' : 'info',
    );
  }

  function boot() {
    if (!location.pathname.startsWith('/chat')) return;

    enableFlutterSemantics();
    installStyles();
    installKeyboardShortcuts();
    installMessageClickGuard();
    installRadarProtection();
    installBrowserTabTitleSync();
    every(refreshPendingReplies, 2000);
    every(reconcileCatalogue, 1000);
    void refreshPendingReplies();
    if (knownChats.length) renderManagerPanel();
    installSidebarWheelGuard();
    syncNativeSidebarLayout();
    syncLoop();
  }

  function syncLoop() {
    syncOpenThreadRead();
    if (!hasFocusedTextEntry() && !isRadarOverlayOpen()) mountControls();
    else syncNativeSidebarLayout();

    later(syncLoop, 500);
  }
  window.__zapiaManager = Object.freeze({
    version: '0.5.35',
    snapshot: runtimeSnapshot,
    dispose: disposeRuntime,
    refresh: scanAllChats,
    status: () => ({
      disposed: lifetime.signal.aborted,
      chats: knownChats.length,
      scanning: chatScanRunning,
      acting: chatActionDepth > 0,
      staleThreads: staleThreadIds.length,
      threadChainComplete: Boolean(threadListFromPages([...threadPages.values()])),
      threadChainAttempts: chainAttempts,
      hasApiSession: Boolean(apiSession),
      pendingReplies: pendingThreadIds.size,
      threadPageCount: threadPages.size,
      timeouts: ownedTimeouts.size,
      intervals: ownedIntervals.size,
      frames: ownedFrames.size,
      observers: ownedObservers.size,
    }),
  });

  installThreadListObserver();

  if (document.body) {
    boot();
  } else {
    document.addEventListener(
      'DOMContentLoaded',
      boot,
      { once: true, signal: lifetime.signal },
    );
  }
})();

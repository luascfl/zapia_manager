// ==UserScript==
// @name         Zapia Manager
// @namespace    https://github.com/luascfl/userscripts
// @version      0.5.2
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
  const HEADER_CLIP_TOP = 50;
  let observerScheduled = false;
  let settingsOpen = false;

  function normalizeSpace(value) {
    return String(value ?? '').replace(/\s+/gu, ' ').trim();
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

  function catalogueView(chats, filters, prefixes, view) {
    const groups = [[], [], [], []];
    const promoted = !view.onlyUnprefixed && (view.prioritizeAgents || view.prioritizeIds);
    for (const chat of filterChats(chats, filters, prefixes)) {
      const completed = chatMatchesFilter(chat.title, 'prefix-0', prefixes);
      const agent = chatMatchesFilter(chat.title, 'prefix-1', prefixes);
      const numbered = chatMatchesFilter(chat.title, 'numbered', prefixes);
      if (view.hideCompleted && completed) continue;
      if (view.onlyUnprefixed && !chat.pinned && (completed || agent || numbered)) continue;
      const rank = !promoted ? 0 : chat.pinned ? 0
        : view.prioritizeAgents && agent ? 1
          : view.prioritizeIds && numbered && !completed ? 2 : 3;
      groups[rank].push(chat);
    }
    return groups.flat();
  }

  function pinnedBetweenSections(position, start, end) {
    return Number.isFinite(start) && Number.isFinite(end) && position >= start && position < end;
  }

  function selectedChats(chats, ids) {
    return chats.filter((chat) => ids.has(chat.id));
  }

  function assertChatTitle(title) {
    if (!title) throw new Error('Não foi possível confirmar o título do chat. Exclusão bloqueada.');
  }

  function mergeChatList(existing, found) {
    const result = [...existing];
    let anchor = -1;

    for (const chat of found) {
      const at = result.findIndex(({ id }) => id === chat.id);

      if (at >= 0) {
        result[at] = chat;
        anchor = at;
      } else {
        anchor += 1;
        result.splice(anchor, 0, chat);
      }
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
      return { prefixes, shortcuts, view };
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
      return 'Use uma tecla de letra, número ou F1–F12 junto de Ctrl, Alt, Shift ou Meta.';
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
      return `${label} é reservado pelo navegador ou sistema.`;
    }

    return null;
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
    isNavigationActionLabel,
    sidebarPlacement,
    rectanglesOverlap,
    selectRootChatRows,
    cleanChatTitle,
    chatMatchesFilter,
    filterChats,
    mergeChatList,
    catalogueView,
    pinnedBetweenSections,
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

    const profileTop = buttons.reduce((top, button) => {
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
        return Math.min(top, rect.top);
      }

      return top;
    }, window.innerHeight);

    return {
      nav,
      navRect,
      top: Math.max(HEADER_CLIP_TOP, primaryBottom),
      bottom: Math.min(window.innerHeight, profileTop),
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

    return cleanChatTitle(rawText) || 'chat sem título';
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
    return semanticButtons().find((element) =>
      !nav?.contains(element)
      && isMenuButtonLabel(semanticLabel(element)),
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
    const alreadyCurrent = activeCatalogueId === id && activeCatalogueUrl === before;
    activeCatalogueId = id;
    row.click();
    if (!alreadyCurrent) {
      await waitFor(
        () => location.href !== before ? semanticMenuButton() : null,
        'the selected chat to open', 3000,
      ).catch(() => {
        if (!semanticMenuButton()) throw new Error('Zapia did not expose the selected chat header.');
      });
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

      if (label === 'Diz-me o que fazer') {
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

      if (label === 'Diz-me o que fazer') {
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

  function installRadarProtection() {
    if (radarProtectionInterval) return;

    const handlePointerDown = (event) => {
      const kind = radarTargetKind(event.target);

      if (!kind) return;

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
    title.textContent = 'Configurar emojis e atalhos';

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
      'Emoji do primeiro prefixo',
      preferences.prefixes[0],
    );

    const emojiTwo = field(
      'Emoji do segundo prefixo',
      preferences.prefixes[1],
    );

    const shortcuts = {};

    for (const action of [
      'prefix-check',
      'prefix-yellow',
      'delete',
    ]) {
      const input = field(
        `Atalho: ${
          action === 'delete'
            ? 'excluir'
            : action === 'prefix-check'
              ? 'primeiro prefixo'
              : 'segundo prefixo'
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

    const actions = document.createElement('div');
    actions.className = 'zapia-manager-settings-actions';

    const cancel = button(
      'Cancelar',
      'Fechar sem salvar',
      () => dialog.close(),
    );

    const save = button(
      'Salvar',
      'Salvar emojis e atalhos',
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
          throw new Error('Use dois emojis diferentes.');
        }

        if (
          Object.values(shortcuts).some(shortcutValidationError)
          || new Set(labels).size !== labels.length
        ) {
          throw new Error(
            'Use atalhos possíveis e diferentes entre si.',
          );
        }

        savePreferences(
          { ...preferences, prefixes, shortcuts },
          window.localStorage,
        );

        dialog.close();
        mountControls();
      },
    );

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
    return catalogueView(knownChats, activeFilters, preferences.prefixes, preferences.view);
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
        'Aguarde a lista de chats terminar de carregar.',
      );
    }
    if (chatActionDepth > 0) {
      throw new Error('Aguarde a ação atual terminar.');
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
      throw new Error('Selecione pelo menos um chat.');
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
        'Conclua ou cancele o diálogo nativo do Zapia antes de excluir outro chat.',
      );
    }

    queueFromSelection();

    if (!deletionQueue.length) {
      throw new Error('Selecione pelo menos um chat.');
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

  function toggleFilter(filter) {
    if (activeFilters.has(filter)) {
      activeFilters.delete(filter);
    } else {
      activeFilters.add(filter);
    }

    const shown = new Set(filteredChats().map(({ id }) => id));

    for (const id of [...selectedChatIds]) {
      if (!shown.has(id)) selectedChatIds.delete(id);
    }

    renderManagerPanel();
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


    const renameItem = button('Renomear', 'Renomear conversa', async () => {
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

    const prefix0Item = button(`${preferences.prefixes[0]} Prefixar`, `Prefixar com ${preferences.prefixes[0]}`, async () => {
      closeRowMenu();
      await runChatAction(async () => {
        await rediscoverAndApply(chat.id, `${preferences.prefixes[0]} `);
      });
    });

    const prefix1Item = button(`${preferences.prefixes[1]} Prefixar`, `Prefixar com ${preferences.prefixes[1]}`, async () => {
      closeRowMenu();
      await runChatAction(async () => {
        await rediscoverAndApply(chat.id, `${preferences.prefixes[1]} `);
      });
    });

    const deleteItem = button('Excluir', 'Excluir conversa', async () => {
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
    await runChatAction(async () => {
      try {
        const row = await findChatRow(id);
        await activateNativeChat(row);
      } finally {
        await scrollSidebarToTop();
      }
    }, { refresh: false });
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
      panel.setAttribute('aria-label', 'Conversas');
      protectManagedSurface(panel);
      document.body.append(panel);
    }
    syncNativeSidebarLayout();
    const state = [
      JSON.stringify(preferences),
      [...activeFilters].sort().join(','),
      chatScanRunning,
      chatActionDepth > 0,
      chatListVersion,
      activeCatalogueId,
      [...selectedChatIds].join('\u0001'),
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
    title.textContent = 'Conversas';
    const summary = document.createElement('span');
    summary.setAttribute('role', 'status');
    summary.textContent = chatScanRunning ? 'Carregando…'
      : selectedChatIds.size ? `${selectedChatIds.size} selecionado${selectedChatIds.size === 1 ? '' : 's'}`
        : activeFilters.size ? `${chats.length} de ${knownChats.length}` : String(knownChats.length);
    headingCopy.append(title, summary);
    const settings = button('Configurar', 'Configurar emojis e atalhos', configurePreferences);
    settings.classList.add('zapia-manager-settings-trigger');
    settings.disabled = busy;
    heading.append(headingCopy, settings);
    panel.append(heading);

    const filters = document.createElement('div');
    filters.className = 'zapia-manager-filters';
    for (const [key, label, hint] of [
      ['numbered', '[nº]', 'Mostrar chats com id [número]'],
      ['prefix-0', preferences.prefixes[0], 'Mostrar chats com o primeiro emoji'],
      ['prefix-1', preferences.prefixes[1], 'Mostrar chats com o segundo emoji'],
    ]) {
      const chip = button(label, hint, () => toggleFilter(key));
      chip.classList.add('zapia-manager-filter');
      chip.classList.toggle('is-active', activeFilters.has(key));
      chip.setAttribute('aria-pressed', String(activeFilters.has(key)));
      filters.append(chip);
    }
    const refresh = button('↻', 'Atualizar lista completa de conversas', scanAllChats);
    refresh.classList.add('zapia-manager-refresh');
    refresh.disabled = busy;
    filters.append(refresh);
    panel.append(filters);

    const advanced = document.createElement('details');
    advanced.className = 'zapia-manager-view-options';
    advanced.open = panel.dataset.viewOptionsOpen === 'true';
    const advancedTitle = document.createElement('summary');
    advancedTitle.textContent = `Filtros e prioridades${Object.values(preferences.view).some(Boolean) ? ' • ativos' : ''}`;
    advanced.append(advancedTitle);
    advanced.addEventListener('toggle', () => { panel.dataset.viewOptionsOpen = String(advanced.open); });
    for (const [key, label] of [
      ['prioritizeAgents', `Priorizar agentes/habilidades (${preferences.prefixes[1]})`],
      ['prioritizeIds', 'Priorizar IDs pendentes'],
      ['hideCompleted', `Ocultar concluídos (${preferences.prefixes[0]})`],
      ['onlyUnprefixed', 'Somente sem prefixo, mantendo fixados'],
    ]) {
      const field = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.viewOption = key;
      input.checked = preferences.view[key];
      input.disabled = busy || (preferences.view.onlyUnprefixed && key.startsWith('prioritize'));
      input.addEventListener('change', () => {
        savePreferences({ ...preferences, view: { ...preferences.view, [key]: input.checked } }, window.localStorage);
        const shown = new Set(filteredChats().map(({ id }) => id));
        for (const id of selectedChatIds) if (!shown.has(id)) selectedChatIds.delete(id);
        renderManagerPanel();
      });
      field.append(input, document.createTextNode(label));
      advanced.append(field);
    }
    panel.append(advanced);

    const list = document.createElement('div');
    list.className = 'zapia-manager-chat-list';
    if (!chats.length) {
      const empty = document.createElement('span');
      empty.className = 'zapia-manager-empty';
      empty.textContent = chatScanRunning ? 'Carregando conversas…' : 'Nenhuma conversa encontrada.';
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
      select.setAttribute('aria-label', `Selecionar ${chat.title}`);
      select.addEventListener('change', () => {
        if (select.checked) selectedChatIds.add(chat.id);
        else selectedChatIds.delete(chat.id);
        renderManagerPanel();
      });
      const open = button(chat.title, `Abrir ${chat.title}`, () => openCatalogueChat(chat.id));
      open.classList.add('zapia-manager-chat-title');
      open.disabled = busy;
      if (chat.id === activeCatalogueId) open.setAttribute('aria-current', 'page');
      const menu = button('⋯', `Mais ações de ${chat.title}`, () => openRowMenu(menu, chat));
      menu.classList.add('zapia-manager-chat-menu');
      menu.disabled = busy;
      option.append(select, open, menu);
      list.append(option);
    }
    panel.append(list);
    list.scrollTop = previousScroll;
    list.addEventListener('scroll', closeRowMenu, { passive: true });

    if (selectedChatIds.size) {
      const actions = document.createElement('div');
      actions.className = 'zapia-manager-panel-actions';
      const prefixOk = button(
        `${preferences.prefixes[0]} Prefixar (${shortcutLabel(preferences.shortcuts['prefix-check'])})`,
        'Aplica o primeiro prefixo aos chats selecionados',
        () => applyPrefixToSelectedChats(`${preferences.prefixes[0]} `),
      );
      const prefixYellow = button(
        `${preferences.prefixes[1]} Prefixar (${shortcutLabel(preferences.shortcuts['prefix-yellow'])})`,
        'Aplica o segundo prefixo aos chats selecionados',
        () => applyPrefixToSelectedChats(`${preferences.prefixes[1]} `),
      );
      const remove = button(
        `Excluir (${shortcutLabel(preferences.shortcuts.delete)})`,
        'Excluir as conversas selecionadas', deleteSelectedChats,
      );
      const clear = button('Limpar seleção', 'Limpar seleção de chats', () => {
        selectedChatIds.clear();
        deletionQueue = [];
        renderManagerPanel();
      });
      for (const action of [prefixOk, prefixYellow, remove, clear]) action.disabled = busy;
      remove.disabled = busy || !selectedChatIds.size;
      actions.append(prefixOk, prefixYellow, remove, clear);
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
    if (viewport && !nativeNavigationAtHome(viewport) && !nativeEntry && !isRadarOverlayOpen()
      && !sidebarHomePending && !chatScanRunning && !chatActionDepth) {
      sidebarHomePending = true;
      void scrollSidebarToTop().catch((error) => toast(error.message, 'error')).finally(() => {
        sidebarHomePending = false;
        if (!lifetime.signal.aborted) syncNativeSidebarLayout();
      });
    }
  }

  function installSidebarWheelGuard() {
    document.addEventListener('wheel', (event) => {
      if (!event.isTrusted || event.target?.closest?.('[data-zapia-manager-control]')) return;
      const panel = document.querySelector('.zapia-manager-sidebar:not(.is-sidebar-hidden)');
      const viewport = getChatViewport();
      if (panel && viewport && event.clientX >= viewport.navRect.left
        && event.clientX < viewport.navRect.right && event.clientY >= viewport.navRect.top
        && event.clientY < viewport.bottom) {
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
        rows.map(nativeChatRecord),
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
        border: 0; border-right: 1px solid #272929; border-radius: 0;
        background: #181919; color: #f2f3f3;
        font: 13px/1.35 Inter, system-ui, sans-serif; pointer-events: auto !important;
      }
      .zapia-manager-sidebar.is-sidebar-hidden { visibility: hidden; pointer-events: none !important; }
      .zapia-manager-panel-heading { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px 6px; }
      .zapia-manager-panel-heading-copy { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
      .zapia-manager-panel-heading strong { font-size: 12px; font-weight: 600; }
      .zapia-manager-panel-heading span { font-size: 11px; color: #a4abaa; }
      .zapia-manager-filters { flex: 0 0 auto; display: flex; gap: 6px; padding: 0 12px 8px; border-bottom: 1px solid #292b2b; }
      .zapia-manager-button { border: 1px solid #373b3b; border-radius: 6px; background: transparent; color: inherit; cursor: pointer; font: inherit; min-block-size: 28px; padding: 4px 7px; pointer-events: auto !important; }
      .zapia-manager-button:hover:not(:disabled) { background: #2a2e2e; }
      .zapia-manager-button:focus-visible { outline: 2px solid #32bfa6; outline-offset: 2px; }
      .zapia-manager-button:disabled { opacity: .45; cursor: default; }
      .zapia-manager-settings-trigger { border: 0; font-size: 11px; color: #b3baba; padding: 2px 0; min-block-size: 22px; }
      .zapia-manager-filter { min-inline-size: 32px; font-size: 12px; min-block-size: 26px; }
      .zapia-manager-filter.is-active { background: #24443d; border-color: #34a38d; }
      .zapia-manager-refresh { margin-inline-start: auto; min-block-size: 26px; min-inline-size: 28px; }
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
      .zapia-manager-toast { position: fixed; z-index: 2147483647 !important; right: 16px; bottom: 16px; max-inline-size: min(420px, calc(100vw - 32px)); padding: 10px; border-radius: 6px; background: #222; color: #fff; font: 14px system-ui, sans-serif; pointer-events: auto !important; }
      .zapia-manager-toast-error { background: #9f1d1d; }
      .zapia-manager-toast-warning { background: #7b5600; }
    `;
    document.head.append(style);
  }

  function boot() {
    if (!location.pathname.startsWith('/chat')) return;

    enableFlutterSemantics();
    installStyles();
    installKeyboardShortcuts();
    installRadarProtection();
    installBrowserTabTitleSync();
    if (knownChats.length) renderManagerPanel();
    installSidebarWheelGuard();
    syncNativeSidebarLayout();
    syncLoop();
  }

  function syncLoop() {
    if (!hasFocusedTextEntry() && !isRadarOverlayOpen()) mountControls();
    else syncNativeSidebarLayout();

    later(syncLoop, 500);
  }

  window.__zapiaManager = Object.freeze({
    version: '0.5.2',
    snapshot: runtimeSnapshot,
    dispose: disposeRuntime,
    refresh: scanAllChats,
    status: () => ({
      disposed: lifetime.signal.aborted,
      chats: knownChats.length,
      scanning: chatScanRunning,
      acting: chatActionDepth > 0,
      timeouts: ownedTimeouts.size,
      intervals: ownedIntervals.size,
      frames: ownedFrames.size,
      observers: ownedObservers.size,
    }),
  });

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

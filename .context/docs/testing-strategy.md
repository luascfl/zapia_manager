---
type: doc
name: testing-strategy
description: Validation approach for the Zapia Manager userscript
category: testing
generated: 2026-09-06
status: curated
---

# Testing strategy

## Automated contracts

Run:

```sh
node --check zapia-manager.user.js
node --test test/zapia-manager.test.mjs
```

The tests cover prefix replacement and idempotence, invalid label rejection, Flutter navigation-label exclusion, leaf chat-row selection, visible selection queueing, text normalization, the critical rule that a delete action is valid only inside a native menu, never a dialog, the observer guard that rejects mutations produced by Zapia Manager itself, suppression of the manager until Zapia renders a chat row, a one-time cache-recovery request that preserves unrelated local-storage data, catalogue ordering and precedence (pinned, agents, pending IDs, completed, only unprefixed), pinned bounds, persisted view options and the agent deletion guard.

## Manual browser validation

Use a logged-in Zapia account in a browser with a userscript manager:

1. Install `zapia-manager.user.js` and open `https://app.zapia.com/chat`.
2. Confirm one integrated `Conversas` list appears below native navigation and above the profile, with no separate floating panel. Wait for initial catalogue discovery to finish.
3. Check numeric and emoji filters against the discovered titles. Use browser text find on a title below the list viewport.
4. Click a visible title, then a title initially outside the native sidebar viewport. Confirm native chat navigation and restoration of `Novo Chat` at the top.
5. Open a row's native menu: both it and the left catalogue must remain visible without overlap. Click another title and confirm the menu closes before navigation.
6. Select a checkbox: only selection and the bulk footer should change, not the current native chat. Open settings and native `Buscar`; verify settings isolation and that the catalogue yields to native search and returns afterward.
7. For rename/delete acceptance, use only a disposable chat created for testing. The script confirms deletion inside Zapia's native dialog; it does not stop for an additional manual confirmation.
8. During development run `node scripts/reload-userscript.mjs --target TARGET_ID`; confirm one sidebar/style remains and no document navigation or repeated catalogue scan occurs.
9. Only after live validation, save the source in Tampermonkey. Reopen the saved editor to compare the complete source, then load a fresh Zapia page without injection and verify its installed runtime version and layout.

On 2026-09-06, a connected authenticated Chrome session verified prefixing `teste` to `✔ teste`, checkbox selection, the native dialog, and final deletion of that user-created test chat. Since 0.2.11 the script itself confirms the native dialog; automated checks avoid that step on real chats by blocking the final `Renomear`/`Excluir` clicks with a spy.

Version 0.4.0 passed 25 Node tests and an authenticated CDP smoke run: 113 chats, filters (5 numbered, 56 first emoji, 24 second emoji), offscreen text find, native title navigation, menu coexistence/dismissal, selection isolation, settings and native search restoration. Tampermonkey's reopened editor matched the validated source exactly; a fresh Zapia page automatically loaded 0.4.0 with one sidebar and no page errors. No chat was renamed or deleted in this cycle.
Version 0.5.x passed 32 Node tests and an authenticated CDP smoke run covering the four options against 113 real chats (pinned groups from native markers, agents first, hidden completed, unprefixed mode with disabled priorities, persistence across hot replacement) and the deletion guard with disposable chats: agent-only selection disables Excluir, a mixed selection deleted only the ordinary chat, the shortcut on an agent opened no menu, and the shortcut on an ordinary chat deleted it. The test chats were removed (the agent through Zapia's own menu) and the catalogue returned to 113 chats. Smoke finding fixed: the guard first read the title from `Informações do chat`, which exists only inside the menu, so it blocked every deletion; it now reads the header button.

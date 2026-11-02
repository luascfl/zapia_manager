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

The tests cover prefix replacement and idempotence, invalid label rejection, Flutter navigation-label exclusion, leaf chat-row selection, visible selection queueing, text normalization, guarded native deletion, observer self-mutation isolation, complete API catalogue reconciliation from an empty initial list, validated sidebar-divider geometry when native navigation semantics are unavailable, cache recovery that preserves unrelated local storage, catalogue ordering and precedence, pinned bounds, persisted view options and chat title confirmation for deletion.

## Manual browser validation

Use a logged-in Zapia account in a browser with a userscript manager:

1. Install `zapia-manager.user.js` and open `https://app.zapia.com/chat`.
2. Confirm one integrated `Chats` list appears below native navigation and above the profile, with no separate floating panel. Verify catalogue bootstrap even when Zapia exposes no native sidebar semantics: the complete API chain must populate the list without scrolling the canvas.
3. Check numeric and emoji filters against the discovered titles. Use browser text find on a title below the list viewport.
4. Click a visible title, then a title initially outside the native sidebar viewport. Confirm the exact thread route and native header. Check that catalogue refresh uses the API when sidebar semantics are unavailable.
5. Open a row's native menu: both it and the left catalogue must remain visible without overlap. Click another title and confirm the menu closes before navigation.
6. Select a checkbox: only selection and the bulk footer should change, not the current native chat. Open settings and native `Buscar`; verify settings isolation and that the catalogue yields to native search and returns afterward.
7. For rename/delete acceptance, use only a disposable chat created for testing. The script confirms deletion inside Zapia's native dialog; it does not stop for an additional manual confirmation.
8. During development run `node scripts/reload-userscript.mjs --target TARGET_ID`; confirm one sidebar/style remains and no document navigation or repeated catalogue scan occurs.
9. After live validation and a version bump, publish the source and trigger the userscript manager's native update through its raw GitHub URL. Confirm the exact installed version in the dashboard, then load a fresh Zapia page without injection and verify its runtime version and layout.

On 2026-09-06, a connected authenticated Chrome session verified prefixing `teste` to `✔ teste`, checkbox selection, the native dialog, and final deletion of that user-created test chat. Since 0.2.11 the script itself confirms the native dialog; automated checks avoid that step on real chats by blocking the final `Renomear`/`Excluir` clicks with a spy.

Version 0.4.0 passed 25 Node tests and an authenticated CDP smoke run: 113 chats, filters (5 numbered, 56 first emoji, 24 second emoji), offscreen text find, native title navigation, menu coexistence/dismissal, selection isolation, settings and native search restoration. Tampermonkey's reopened editor matched the validated source exactly; a fresh Zapia page automatically loaded 0.4.0 with one sidebar and no page errors. No chat was renamed or deleted in this cycle.
Version 0.5.x passed 33 Node tests and authenticated CDP smoke runs covering the four options against real chats (pinned groups from native markers, agents first, hidden completed, unprefixed mode with disabled priorities, persistence across hot replacement). Version 0.5.2 removed the agent deletion lock. Version 0.5.3 added panel minimization (`-`/`+`), gear icon (`⚙`) for settings, and elevated the unprefixed filter to a blank button immediately to the left of `[nº]`, keeping the refresh button (`↻`) pinned to the right.

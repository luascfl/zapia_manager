---
type: doc
name: project-overview
description: Purpose and runtime boundaries of the Zapia Manager userscript
category: overview
generated: 2026-09-06
status: curated
---

# Zapia Manager

A dependency-free userscript for Tampermonkey or Violentmonkey that manages Zapia Chat rows at `https://app.zapia.com/chat`.

## Capabilities

- Applies one managed title prefix, `✔ ` or `🟡 `, through Zapia’s visible rename flow.
- Integrates the complete searchable DOM catalogue into the native sidebar's chat-list area, with `[number]`/emoji filters, title navigation and per-row native menus. The original logo, navigation and profile remain visible; there is no floating panel.
- Deletes selected chats one at a time through Zapia’s native menu, confirming only inside the native `Excluir conversa?` dialog.
- Re-mounts controls after SPA changes with a `MutationObserver`.
- Shows bulk actions only while chats are selected; emojis and keyboard shortcuts remain configurable through the gear button (`⚙`). The panel can be minimized (`-`/`+`) into a transparent, non-blocking header control so native sidebar navigation behind it remains fully accessible without losing scan state.
- Offers quick filters for unprefixed chats (blank chip to the left of `[nº]`), numeric IDs and managed emojis, inline search (`🔍`), and refresh (`↻`) on the right. When search is activated, an inline text field replaces filter chips to filter the chat list in real-time, and the search button transforms into a clear button (`×`) that resets the query and restores chips. Persisted catalogue options under `Filters and priorities` include prioritize agents (🟡), prioritize pending IDs, and hide completed (✔). All chats can be deleted through the Manager with native dialog confirmation.
- Updates itself from GitHub: `@updateURL` and `@downloadURL` point to the raw file of `luascfl/zapia_manager` on `main`; raise `@version` for every release.

## Entry points

- `zapia-manager.user.js`, production userscript.
- `test/zapia-manager.test.mjs`, Node contract tests.
- `scripts/reload-userscript.mjs`, development-only source replacement through CDP; preserves the catalogue and UI state without reloading Zapia.

## Runtime and boundaries

The script runs in Chrome/LibreWolf under Tampermonkey/Violentmonkey, has no network privileges or dependencies, and uses DOM-only native interactions. It reports an error when native controls cannot be identified. The development injector requires Node.js 22+ and an authenticated Chrome CDP tab; it does not update the installed extension script.

Run validation with:

```sh
node --check zapia-manager.user.js
node --test test/zapia-manager.test.mjs
```

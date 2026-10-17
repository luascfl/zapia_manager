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
- Shows bulk actions only while chats are selected; emojis and keyboard shortcuts remain configurable through `Configurar`.

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

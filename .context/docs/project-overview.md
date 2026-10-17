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
- Mounts accessible checkboxes and a selected-count toolbar on visible chat rows.
- Deletes selected chats one at a time through Zapia’s native menu, confirming only inside the native `Excluir conversa?` dialog.
- Re-mounts controls after SPA changes with a `MutationObserver`.

## Entry points

- `zapia-manager.user.js`, production userscript.
- `test/zapia-manager.test.mjs`, Node contract tests.

## Runtime and boundaries

The script runs in LibreWolf under Violentmonkey, has no network privileges or dependencies, and uses DOM-only interaction. It is intentionally conservative: if Zapia does not expose a recognizable native menu, rename dialog, or deletion menu item, it reports an error instead of guessing.

Run validation with:

```sh
node --check zapia-manager.user.js
node --test test/zapia-manager.test.mjs
```

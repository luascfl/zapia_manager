# Zapia Manager

## Product

A Tampermonkey/Violentmonkey userscript that adds deliberate chat-labeling, bulk-management and keyboard-shortcut controls to Zapia Chat.

## Scope

- Target `https://app.zapia.com/chat` only.
- Add configurable emoji prefixes (default `✔ ` and `🟡 `) to chat titles through Zapia’s visible edit interface.
- Integrate selection checkboxes, title navigation, per-row native menus and a selection-only bulk toolbar into the native sidebar's chat-list area, preserving its navigation and profile.
- Delete through each chat’s native menu and confirm only inside Zapia’s own `Excluir conversa?` dialog, one chat at a time (changed on 2026-09-17 at the user’s request; it previously stopped at the dialog).
- Act on the current chat through configurable shortcuts (defaults `Alt+Shift+C`, `Alt+Shift+Y`, `Alt+Shift+X`).
- Render all discovered sidebar chats as searchable DOM text and filter by numeric id or either configured emoji.
- Reinject local userscript source during development without reloading Zapia or rescanning a completed catalogue.
- Remain responsive to Zapia SPA updates through a `MutationObserver`.

## Safety boundaries

- No direct API calls, hidden endpoints, or data scraping.
- No coordinate automation or fixed-delay logic. Native menu actions are matched by exact label, never free text.
- Final confirmation is scoped to the visible native delete dialog, never to a menu item.

## Runtime

- Chrome or LibreWolf with Tampermonkey or Violentmonkey.
- Plain JavaScript user script, no build step or external dependencies.

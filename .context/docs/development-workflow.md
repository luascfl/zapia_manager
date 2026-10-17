# Development workflow

## Runtime and checks

The production artifact is `zapia-manager.user.js`, a self-contained userscript. There is no build step or package install.

```sh
node --check zapia-manager.user.js
node --check scripts/reload-userscript.mjs
node --test test/zapia-manager.test.mjs
```

## Replace only the userscript

Use Node.js 22+ (global `WebSocket`) and an existing authenticated Chrome session on CDP port 9222 with Zapia open. The canonical development command is:

```sh
node scripts/reload-userscript.mjs
```

The command reads the current file, checks syntax, and replaces only the userscript. It does not reload Zapia, reinstall an extension, or restart the chat catalogue scan. It preserves the catalogue, filters, selection, collapse state and list scroll. The previous instance disposes its own document listeners, timeouts, intervals, frames, pending waits and observers before the new instance mounts. A native rename/delete action must finish before replacement is permitted.

When several Zapia tabs exist, select the exact CDP target id:

```sh
node scripts/reload-userscript.mjs --target CDP_TARGET_ID
```

For an old injected instance without a cleanup hook, migrate once:

```sh
node scripts/reload-userscript.mjs --migrate
```

This one-time migration snapshots the legacy panel into session storage and reloads the document to remove untracked legacy listeners. All subsequent runs omit `--migrate` and replace in place. Run migration only after the old scan finishes and with all filters disabled, so its DOM snapshot contains the complete known catalogue.

This command applies source to the current page only. It does not persist updates into Tampermonkey or Violentmonkey; reloading the page restores the extension-installed version until that installation is updated separately.

## Browser validation

- Reuse the exact test tab; do not navigate/reload it for each code edit.
- Observe the command's `documentReloaded: false`, catalogue count, and single panel/style instance.
- Open the panel before browser text search. All loaded titles are real DOM text, including rows below the list viewport. Active filters restrict the searchable list.
- Filters `[nº]`, emoji 1 and emoji 2 use OR. Switching filters drops hidden selections.
- `Atualizar lista` explicitly repeats native sidebar traversal. A source reload reuses the completed catalogue instead.
- For offscreen action checks, block the native save/delete confirmation and cancel the native dialog. Do not mutate user data merely to prove discovery.
- Compare retained state and ensure the old runtime reports zero owned resources after replacement.

## Cycle closeout

Follow one story in `.context/workflow/prd.json`. Store evidence under `.context/workflow/ralph/evidence/`, update STATE and the technical docs, run `graphify update .` after code changes, and commit only files owned by the story. Do not push unless requested.

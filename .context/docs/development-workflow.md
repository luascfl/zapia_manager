# Development workflow

## Runtime and checks

The production artifact is `zapia-manager.user.js`, a self-contained userscript. There is no build step or package install.

```sh
node --check zapia-manager.user.js
node --check scripts/reload-userscript.mjs
node --check scripts/zapia-cli.mjs
node --test test/zapia-manager.test.mjs test/zapia-cli.test.mjs
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

## Zapia CLI (list, read, send)

`scripts/zapia-cli.mjs` lets an agent list threads, read messages and send messages through the logged-in Zapia tab of the persistent Chrome (CDP 9222). It needs Node.js 22+ and no packages.

```sh
node scripts/zapia-cli.mjs list [--limit 50]
node scripts/zapia-cli.mjs read <thread> [--limit 20]
node scripts/zapia-cli.mjs send <thread|--new> "text" [--wait SECONDS]
```

- `<thread>` is a thread id, an exact title or a unique title fragment. An ambiguous or unknown query is refused with the candidates and nothing is sent. Titles come from the API, not from the sidebar, which can show stale titles.
- Reads use Zapia's own REST endpoints from inside the page. The session parameters are taken from the page's own requests and never leave the browser or appear in output.
- `send` opens the thread through its route, `/chat?pulsusNumber=<thread id>`, or `/chat` for `--new`. It activates Flutter's accessibility placeholder so the labelled composer exists, types, and presses a trusted Enter key. No screen coordinates are used.
- A send is never retried. It is confirmed by finding the exact text in the thread through the API, and an unconfirmed send reports `send_unconfirmed` so the caller can inspect the tab before trying again.
- `--wait` returns the assistant reply once its text is unchanged across two polls. Zapia replies can include structured JSON strings; they are returned as received.
- Locale: the composer is found by its accessible name (default `Pergunte-me qualquer coisa`). Set `ZAPIA_COMPOSER_LABEL` when the UI language differs.
- Validated on 2026-10-26 against a disposable chat: list, read, send to an existing thread with reply, send to a new chat with reply, and the ambiguous, unknown and usage error paths.

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

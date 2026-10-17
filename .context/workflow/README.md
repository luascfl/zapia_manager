# Ralph workflow

Milestone 4, US-006, is complete: the catalogue occupies only the native sidebar's chat-list area, with native title/menu navigation and no floating panel. Version 0.4.0 was validated live, saved in Tampermonkey, compared with the reopened persisted source and exercised on a fresh Zapia page. See `.context/plans/ROADMAP.md`. US-004 remains open; message bodies now render, so its shortcut/link investigation can resume as a separate story.

Definition of done for every story:

1. Acceptance criteria in `prd.json` are met.
2. `node --check` and the Node test suite pass.
3. A smoke run in an authenticated Zapia session (CDP-driven Chrome) exercises the changed path. Use `node scripts/reload-userscript.mjs` for source-only iteration; after saving a release in Tampermonkey, also check automatic startup on a fresh page without injection.
4. `STATE.md`, `prd.json` and `.context/docs` are updated, `graphify update .` is run, and the change is committed.

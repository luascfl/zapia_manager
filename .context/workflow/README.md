# Ralph workflow

Milestone 4, US-006, is complete: the catalogue occupies only the native sidebar's chat-list area, with native title/menu navigation and no floating panel. Version 0.5.15 is saved in Tampermonkey and verified on a fresh page. See `.context/plans/ROADMAP.md`. US-004 remains open: the shortcut/link case was not reproduced; 0.5.15 only restricts the native menu button to the chat header band.

Definition of done for every story:

1. Acceptance criteria in `prd.json` are met.
2. `node --check` and the Node test suite pass.
3. A smoke run in an authenticated Zapia session (CDP-driven Chrome) exercises the changed path. Use `node scripts/reload-userscript.mjs` for source-only iteration; after saving a release in Tampermonkey, also check automatic startup on a fresh page without injection.
4. `STATE.md`, `prd.json` and `.context/docs` are updated, `graphify update .` is run, and the change is committed.

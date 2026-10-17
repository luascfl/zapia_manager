# Ralph workflow

Milestone 3, US-005, is complete: full chat catalogue, filters and source-only browser reload. See `.context/plans/ROADMAP.md`. US-004 remains open; this cycle identified a competing sidebar `Mais ações` control but did not reproduce a chat link opening.

Definition of done for every story:

1. Acceptance criteria in `prd.json` are met.
2. `node --check` and the Node test suite pass.
3. A smoke run in an authenticated Zapia session (CDP-driven Chrome with the source injected) exercises the changed path.
4. `STATE.md`, `prd.json` and `.context/docs` are updated, `graphify update .` is run, and the change is committed.

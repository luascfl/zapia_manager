# Ralph workflow

The active milestone is Milestone 2 in `.context/plans/ROADMAP.md`. Next open story: `US-004` in `prd.json` (a repro may now be possible; see its notes).

Definition of done for every story:

1. Acceptance criteria in `prd.json` are met.
2. `node --check` and the Node test suite pass.
3. A smoke run in an authenticated Zapia session (CDP-driven Chrome with the source injected) exercises the changed path.
4. `STATE.md`, `prd.json` and `.context/docs` are updated, `graphify update .` is run, and the change is committed.

# Roadmap

## Milestone 1: Safe Zapia chat manager

### Phase 1: Runtime discovery and chat labelling

Dependency: none.

Deliver a Violentmonkey user script that discovers Zapia chat rows and applies one managed title prefix through its visible UI.

### Phase 2: Bulk selection and guarded deletion

Dependency: Phase 1.

Add selectable chat rows and an accessible bulk toolbar that confirms deletion only inside Zapia's own native confirmation dialog, one chat at a time.

### Phase 3: Browser validation and release

Dependency: Phase 2 and an authenticated LibreWolf Zapia session.

Install the script in Violentmonkey, exercise labels and selection in Zapia, then capture observed selectors and regressions.

## Milestone 2: Reliable current-chat actions

Dependency: Milestone 1.

- US-002 (done): keep navigation banners such as `Ganhe o Zapia Pro de graça` out of the chat list.
- US-003 (done): keep the manager panel from covering Zapia’s native chat menu.
- US-004: find why a shortcut sometimes opens a chat link (blocked on a repro).

## Milestone 3: Searchable chat catalogue

Dependency: Milestone 2 panel/menu isolation.

- US-005 (done): load the complete sidebar catalogue, make full titles searchable with browser find, filter by `[number]` and either configured emoji, and support userscript-only reloads that preserve the catalogue for fast browser testing.

## Milestone 4: Seamless native-area catalogue

Dependency: Milestone 3 catalogue and in-place development reload.

- US-006 (done): integrate the catalogue and controls into the native sidebar's chat-list area, validate the surface, then update and verify Tampermonkey. Delivered in 0.4.0.


## Milestone 5: Advanced catalogue rules and reusable-agent safety

Dependency: Milestone 4 integrated sidebar and lifecycle reload.

- US-007 (done): persist four optional catalogue rules and preserve structurally identified native pins. In version 0.5.2, agent deletion restrictions were removed per user direction so all chats can be deleted via native confirmation.


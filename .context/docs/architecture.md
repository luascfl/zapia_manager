# Architecture

`zapia-manager.user.js` is a self-contained browser module. `scripts/reload-userscript.mjs` is a development-only CDP injector with no third-party dependencies.

## Components

| Component | Responsibility |
| --- | --- |
| Sidebar discovery | Excludes navigation, promotional banners and hover actions; normalizes unread counters and sorts native rows by visual position because Flutter recycles semantic nodes. |
| Catalogue | Traverses the sidebar in both directions using wheel events scoped to the navigation viewport. Merges overlapping windows by identity and returns native navigation to its top position. The in-memory catalogue survives userscript replacement. |
| Sidebar surface | Replaces only the Canvas chat-list area with complete DOM titles. Its bounds follow the native navigation container and end above the profile; logo, primary navigation and main chat remain native. A minimize control (`-`/`+`) collapses the panel to a transparent, non-blocking header trigger without unmounting, losing selection or rescanning, allowing the native sidebar behind it to remain usable. The settings trigger is a gear (`⚙`). Browser text find reaches offscreen rows, and list scroll survives rendering and source replacement. |
| Filters | Matches leading numeric `[id]` or either configured emoji (including checkmark variation selectors), combining those selected chips with OR. A blank button immediately before `[nº]` enables the persisted unprefixed catalogue rule. Clicking the search button (`🔍`) opens an inline search input within the Manager filter bar, filtering the complete chat catalogue in real-time by text (case and accent-insensitive), and converts the search button into `×` to clear and close the query; the refresh action (`↻`) stays pinned on the right of the filter bar. Hidden selections are cleared when filtering removes them. |
| Catalogue rules | `catalogueView` applies four optional, persisted rules (`preferences.view`, all off by default) after the id/emoji filters: prioritize agents (second emoji), prioritize pending IDs (`[n]` without the completed emoji), hide completed (including pinned), and only unprefixed. Order is pinned, agents, pending IDs, rest; native order is kept inside each group and no chat is duplicated. Only unprefixed keeps surviving pinned chats and overrides both priorities. |
| Pinned membership | Each chat record carries `pinned`, derived from native structure: the row position inside Flutter's scrollable semantic group compared with the `Fixados` and `Conversas` section markers (`captureNativeSections`, `pinnedBetweenSections`). Markers are only rendered while near the viewport, so bounds are remembered per group and reset at each scan. A stale catalogue without the field is rescanned. |
| Native actions | Title buttons reveal and open native chats; row menus reveal the correct chat before opening its header menu. Existing menus are dismissed with focused Escape after Flutter applies semantic focus across rendering frames. Source navigation returns to the top, including on errors. Rename/delete actions use exact labels; header lookup excludes sidebar hover controls. |
| Deletion | Confirms deletion only inside Zapia's native confirmation dialog; never uses a hidden endpoint or a menu item as final confirmation. All chats (including agents with the second emoji) can be deleted through the Manager; `deleteChat` blocks only if the native chat header title cannot be confirmed. Zapia's own native confirmation dialog remains the final guard. |
| Runtime lifecycle | `window.__zapiaManager` owns cleanup, snapshots, explicit refresh and status. Replacement aborts document listeners, clears owned scheduling, disconnects observers, cancels pending waits and removes only its own UI/style. |
| Development reload | Injects current local source into one verified Zapia CDP target, retaining page/navigation state and the completed catalogue. One explicit legacy migration is necessary for old instances without cleanup hooks. |

## Invariants and limits

1. Prefixing replaces a managed prefix rather than stacking it. Prefix and id filters tolerate the checkmark variation selector and missing spaces.
2. Catalogue traversal reads only the native sidebar. No Zapia API, cookies or hidden data endpoints are consulted.
3. Native actions are rediscovered at execution time; recycled DOM nodes are not retained as chat identity.
4. UI snapshots contain discovered titles and state, not live DOM references. The registry is in memory; only the development-only legacy migration temporarily uses session storage.
5. A source replacement is refused during a native action. A catalogue scan can be cancelled while keeping a previously completed catalogue.
6. The catalogue hides for native sidebar text entry, Radar, unavailable/offscreen sidebar geometry, or an actually overlapping native menu. A right-hand menu does not hide the left catalogue. Managed pointer/wheel events do not leak through to Canvas controls.
7. Flutter exposes title-based identities rather than stable chat ids. Equal titles cannot be distinguished reliably by the existing DOM contract.
8. Initial discovery still requires native sidebar scrolling and a foreground/rendering tab. Hot replacement does not repeat that discovery. Manual `Atualizar lista` or post-action refresh discovers changes.
9. This is a DOM replacement within the native sidebar's list area, not a modification of Flutter Canvas internals. Floating-panel, collapse and launcher paths have been removed.
10. `nextFrame` falls back to a 250 ms timer because `requestAnimationFrame` pauses in a background tab and would otherwise stall catalogue scans; sidebar scroll still has to change the semantic signature.

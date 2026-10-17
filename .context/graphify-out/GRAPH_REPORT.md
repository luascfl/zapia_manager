# Graph Report - zapia_manager  (2026-10-17)

## Corpus Check
- 3 files · ~17,818 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 136 nodes · 320 edges · 9 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]

## God Nodes (most connected - your core abstractions)
1. `mountControls()` - 18 edges
2. `renderManagerPanel()` - 15 edges
3. `syncNativeSidebarLayout()` - 13 edges
4. `normalizeSpace()` - 11 edges
5. `waitFor()` - 10 edges
6. `deleteChat()` - 10 edges
7. `boot()` - 10 edges
8. `activateNativeChat()` - 8 edges
9. `applyPrefix()` - 8 edges
10. `scanAllChats()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `applyPrefix()` --calls--> `withPrefix()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 0 → community 2_
- `catalogueView()` --calls--> `chatMatchesFilter()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 0 → community 4_
- `savePreferences()` --calls--> `loadPreferences()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 5 → community 4_
- `runChatAction()` --calls--> `assertRuntimeActive()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 2 → community 6_
- `syncLoop()` --calls--> `later()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 6 → community 1_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.1
Nodes (21): button(), chatMatchesFilter(), closeRowMenu(), configuredPrefixes(), configurePreferences(), frame(), isShortcut(), isVisible() (+13 more)

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (23): collectSidebarChats(), discoverChatRows(), getChatViewport(), hasChatHoverAction(), hasFocusedTextEntry(), isEditableTarget(), isRadarOverlayOpen(), mergeChatList() (+15 more)

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (19): activateNativeChat(), applyPrefix(), assertChatTitle(), assertRuntimeActive(), deleteChat(), dismissNativeMenu(), findChatRow(), nextFrame() (+11 more)

### Community 3 - "Community 3"
Cohesion: 0.15
Nodes (17): canActivateDeleteCandidate(), captureNativeSections(), chatIdentity(), chatTitle(), cleanChatTitle(), currentChatHeaderTitle(), getActiveChatTitleForBrowserTab(), isFlutterChatRow() (+9 more)

### Community 4 - "Community 4"
Cohesion: 0.19
Nodes (14): catalogueView(), clearNativeSearch(), filterChats(), filteredChats(), nativeSearchButton(), nativeSearchInput(), openNativeSearch(), pruneHiddenSelection() (+6 more)

### Community 5 - "Community 5"
Cohesion: 0.18
Nodes (11): boot(), detectRadarOverlay(), enableFlutterSemantics(), every(), installBrowserTabTitleSync(), installKeyboardShortcuts(), installRadarProtection(), installSidebarWheelGuard() (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.28
Nodes (9): applyPrefixToSelectedChats(), deleteSelectedChats(), later(), openCatalogueChat(), queueFromSelection(), runChatAction(), runCurrentChatShortcut(), scheduleChatRescan() (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.4
Nodes (5): semanticButton(), semanticButtons(), semanticMenuButton(), visibleSaveAction(), visibleSemanticMenuAction()

### Community 8 - "Community 8"
Cohesion: 0.83
Nodes (3): evaluate(), send(), waitForState()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mountControls()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `renderManagerPanel()` connect `Community 4` to `Community 0`, `Community 1`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `syncNativeSidebarLayout()` connect `Community 1` to `Community 0`, `Community 2`, `Community 4`, `Community 5`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
# Graph Report - zapia_manager  (2026-10-17)

## Corpus Check
- 3 files · ~17,869 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 137 nodes · 321 edges · 8 communities detected
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

## God Nodes (most connected - your core abstractions)
1. `mountControls()` - 18 edges
2. `renderManagerPanel()` - 15 edges
3. `syncNativeSidebarLayout()` - 13 edges
4. `normalizeSpace()` - 12 edges
5. `deleteChat()` - 10 edges
6. `boot()` - 10 edges
7. `waitFor()` - 8 edges
8. `activateNativeChat()` - 8 edges
9. `applyPrefix()` - 8 edges
10. `scanAllChats()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `semanticLabel()` --calls--> `normalizeSpace()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 4 → community 0_
- `currentChatHeaderTitle()` --calls--> `normalizeSpace()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 4 → community 6_
- `applyPrefix()` --calls--> `withPrefix()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 0 → community 3_
- `filteredChats()` --calls--> `filterChatsByQuery()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 4 → community 2_
- `filteredChats()` --calls--> `catalogueView()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 0 → community 2_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.1
Nodes (23): boot(), catalogueView(), chatMatchesFilter(), configuredPrefixes(), detectRadarOverlay(), enableFlutterSemantics(), every(), filterChats() (+15 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (26): captureNativeSections(), collectSidebarChats(), discoverChatRows(), getChatViewport(), hasChatHoverAction(), hasFocusedTextEntry(), isEditableTarget(), isRadarOverlayOpen() (+18 more)

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (19): button(), clearCatalogueSearch(), closeRowMenu(), configurePreferences(), filteredChats(), isShortcut(), openCatalogueSearch(), openRowMenu() (+11 more)

### Community 3 - "Community 3"
Cohesion: 0.2
Nodes (17): activateNativeChat(), applyPrefix(), assertChatTitle(), assertRuntimeActive(), deleteChat(), dismissNativeMenu(), findChatRow(), nextFrame() (+9 more)

### Community 4 - "Community 4"
Cohesion: 0.16
Nodes (16): canActivateDeleteCandidate(), chatIdentity(), chatTitle(), cleanChatTitle(), filterChatsByQuery(), getActiveChatTitleForBrowserTab(), isFlutterChatRow(), isHoverActionLabel() (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.2
Nodes (12): applyPrefixToSelectedChats(), deleteSelectedChats(), later(), nativeDeleteConfirmAction(), nativeDeleteDialog(), nativeDeleteDialogOpen(), openCatalogueChat(), queueFromSelection() (+4 more)

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (7): currentChatHeaderTitle(), semanticButton(), semanticButtons(), visibleMenuAction(), visibleMenus(), visibleSaveAction(), visibleSemanticMenuAction()

### Community 7 - "Community 7"
Cohesion: 0.83
Nodes (3): evaluate(), send(), waitForState()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mountControls()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 5`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `renderManagerPanel()` connect `Community 2` to `Community 0`, `Community 1`, `Community 5`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `syncNativeSidebarLayout()` connect `Community 1` to `Community 0`, `Community 2`, `Community 6`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
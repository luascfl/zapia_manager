# Graph Report - zapia_manager  (2026-10-17)

## Corpus Check
- 3 files · ~18,987 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 147 nodes · 346 edges · 7 communities detected
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

## God Nodes (most connected - your core abstractions)
1. `mountControls()` - 18 edges
2. `renderManagerPanel()` - 17 edges
3. `syncNativeSidebarLayout()` - 13 edges
4. `normalizeSpace()` - 12 edges
5. `deleteChat()` - 10 edges
6. `boot()` - 10 edges
7. `activateNativeChat()` - 9 edges
8. `runChatAction()` - 9 edges
9. `waitFor()` - 8 edges
10. `applyPrefix()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `semanticLabel()` --calls--> `normalizeSpace()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 4 → community 0_
- `applyPrefix()` --calls--> `withPrefix()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 0 → community 1_
- `filteredChats()` --calls--> `filterChatsByQuery()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 4 → community 3_
- `filteredChats()` --calls--> `catalogueView()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 0 → community 3_
- `runChatAction()` --calls--> `assertRuntimeActive()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 1 → community 5_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (23): boot(), catalogueView(), chatMatchesFilter(), configuredPrefixes(), detectRadarOverlay(), enableFlutterSemantics(), every(), filterChats() (+15 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (25): activateNativeChat(), applyPrefix(), assertChatTitle(), assertRuntimeActive(), deleteChat(), dismissNativeMenu(), findChatRow(), nextFrame() (+17 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (25): captureNativeSections(), collectSidebarChats(), discoverChatRows(), getChatViewport(), hasChatHoverAction(), hasFocusedTextEntry(), isEditableTarget(), isRadarOverlayOpen() (+17 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (22): button(), clearCatalogueSearch(), closeRowMenu(), configurePreferences(), excludeHiddenChats(), filteredChats(), hideChat(), isShortcut() (+14 more)

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (17): canActivateDeleteCandidate(), chatIdentity(), chatTitle(), cleanChatTitle(), currentChatHeaderTitle(), filterChatsByQuery(), getActiveChatTitleForBrowserTab(), isFlutterChatRow() (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.16
Nodes (16): applyPrefixToSelectedChats(), buildSupportDiagnosticPayload(), deleteSelectedChats(), isUnavailableChatError(), later(), nativeDeleteConfirmAction(), nativeDeleteDialog(), nativeDeleteDialogOpen() (+8 more)

### Community 6 - "Community 6"
Cohesion: 0.83
Nodes (3): evaluate(), send(), waitForState()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mountControls()` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`, `Community 5`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `renderManagerPanel()` connect `Community 3` to `Community 0`, `Community 2`, `Community 5`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `syncNativeSidebarLayout()` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
# Graph Report - zapia_manager  (2026-10-17)

## Corpus Check
- 3 files · ~15,528 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 119 nodes · 267 edges · 9 communities detected
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
1. `mountControls()` - 17 edges
2. `syncNativeSidebarLayout()` - 13 edges
3. `normalizeSpace()` - 10 edges
4. `renderManagerPanel()` - 10 edges
5. `boot()` - 10 edges
6. `waitFor()` - 8 edges
7. `applyPrefix()` - 8 edges
8. `scanAllChats()` - 8 edges
9. `runChatAction()` - 8 edges
10. `activateNativeChat()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `semanticLabel()` --calls--> `normalizeSpace()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 2 → community 0_
- `applyPrefix()` --calls--> `withPrefix()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 8 → community 3_
- `runChatAction()` --calls--> `assertRuntimeActive()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 3 → community 4_
- `syncLoop()` --calls--> `later()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 4 → community 1_
- `mountControls()` --calls--> `enableFlutterSemantics()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 0 → community 1_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (19): boot(), chatMatchesFilter(), detectRadarOverlay(), enableFlutterSemantics(), every(), frame(), installBrowserTabTitleSync(), installKeyboardShortcuts() (+11 more)

### Community 1 - "Community 1"
Cohesion: 0.16
Nodes (20): getChatViewport(), hasChatHoverAction(), hasFocusedTextEntry(), isEditableTarget(), isRadarOverlayOpen(), mergeChatList(), mountControls(), nativeNavigationAtHome() (+12 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (17): canActivateDeleteCandidate(), chatIdentity(), chatTitle(), cleanChatTitle(), collectSidebarChats(), discoverChatRows(), getActiveChatTitleForBrowserTab(), isFlutterChatRow() (+9 more)

### Community 3 - "Community 3"
Cohesion: 0.24
Nodes (14): activateNativeChat(), applyPrefix(), assertRuntimeActive(), deleteChat(), dismissNativeMenu(), findChatRow(), nextFrame(), openCurrentNativeActions() (+6 more)

### Community 4 - "Community 4"
Cohesion: 0.2
Nodes (12): applyPrefixToSelectedChats(), deleteSelectedChats(), later(), nativeDeleteConfirmAction(), nativeDeleteDialog(), nativeDeleteDialogOpen(), openCatalogueChat(), queueFromSelection() (+4 more)

### Community 5 - "Community 5"
Cohesion: 0.24
Nodes (11): button(), configurePreferences(), filterChats(), filteredChats(), isShortcut(), parseShortcut(), protectManagedSurface(), renderManagerPanel() (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (7): semanticButton(), semanticButtons(), semanticMenuButton(), visibleMenuAction(), visibleMenus(), visibleSaveAction(), visibleSemanticMenuAction()

### Community 7 - "Community 7"
Cohesion: 0.83
Nodes (3): evaluate(), send(), waitForState()

### Community 8 - "Community 8"
Cohesion: 1.0
Nodes (3): configuredPrefixes(), stripManagedPrefix(), withPrefix()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mountControls()` connect `Community 1` to `Community 0`, `Community 2`, `Community 4`, `Community 5`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `syncNativeSidebarLayout()` connect `Community 1` to `Community 0`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `normalizeSpace()` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
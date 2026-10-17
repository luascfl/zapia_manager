# Graph Report - zapia_manager  (2026-10-17)

## Corpus Check
- 3 files · ~18,524 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 142 nodes · 334 edges · 12 communities detected
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
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 12|Community 12]]

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
- `currentChatHeaderTitle()` --calls--> `normalizeSpace()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 3 → community 0_
- `applyPrefix()` --calls--> `withPrefix()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 10 → community 0_
- `filteredChats()` --calls--> `filterChatsByQuery()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 3 → community 2_
- `filteredChats()` --calls--> `catalogueView()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 8 → community 2_
- `savePreferences()` --calls--> `loadPreferences()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 7 → community 2_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (25): activateNativeChat(), applyPrefix(), assertChatTitle(), assertRuntimeActive(), currentChatHeaderTitle(), deleteChat(), dismissNativeMenu(), findChatRow() (+17 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (24): collectSidebarChats(), discoverChatRows(), getChatViewport(), hasChatHoverAction(), hasFocusedTextEntry(), isEditableTarget(), isRadarOverlayOpen(), mergeChatList() (+16 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (22): button(), clearCatalogueSearch(), closeRowMenu(), configurePreferences(), excludeHiddenChats(), filteredChats(), hideChat(), isShortcut() (+14 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (18): canActivateDeleteCandidate(), captureNativeSections(), chatIdentity(), chatTitle(), cleanChatTitle(), filterChatsByQuery(), getActiveChatTitleForBrowserTab(), isFlutterChatRow() (+10 more)

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (5): frame(), nativeDeleteConfirmAction(), nativeDeleteDialog(), nativeDeleteDialogOpen(), scheduleBrowserTabTitleSync()

### Community 5 - "Community 5"
Cohesion: 0.24
Nodes (10): applyPrefixToSelectedChats(), deleteSelectedChats(), later(), openCatalogueChat(), promptUnavailableChatRecovery(), queueFromSelection(), runChatAction(), runCurrentChatShortcut() (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (6): boot(), enableFlutterSemantics(), installBrowserTabTitleSync(), installKeyboardShortcuts(), installSidebarWheelGuard(), installStyles()

### Community 7 - "Community 7"
Cohesion: 0.4
Nodes (5): detectRadarOverlay(), every(), installRadarProtection(), loadPreferences(), refreshRadarOverlayState()

### Community 8 - "Community 8"
Cohesion: 0.5
Nodes (4): catalogueView(), chatMatchesFilter(), filterChats(), normalizeEmoji()

### Community 9 - "Community 9"
Cohesion: 0.83
Nodes (3): evaluate(), send(), waitForState()

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (3): configuredPrefixes(), stripManagedPrefix(), withPrefix()

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (2): isVisible(), nativeRenameInput()

## Knowledge Gaps
- **Thin community `Community 12`** (2 nodes): `isVisible()`, `nativeRenameInput()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mountControls()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `renderManagerPanel()` connect `Community 2` to `Community 1`, `Community 4`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `syncNativeSidebarLayout()` connect `Community 1` to `Community 0`, `Community 2`, `Community 4`, `Community 6`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
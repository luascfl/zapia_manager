# Graph Report - zapia_manager  (2026-10-17)

## Corpus Check
- 3 files · ~17,437 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 129 nodes · 299 edges · 13 communities detected
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
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]

## God Nodes (most connected - your core abstractions)
1. `mountControls()` - 18 edges
2. `syncNativeSidebarLayout()` - 13 edges
3. `normalizeSpace()` - 11 edges
4. `deleteChat()` - 10 edges
5. `renderManagerPanel()` - 10 edges
6. `boot()` - 10 edges
7. `waitFor()` - 8 edges
8. `activateNativeChat()` - 8 edges
9. `applyPrefix()` - 8 edges
10. `scanAllChats()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `chatIdentity()` --calls--> `normalizeSpace()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 7 → community 3_
- `semanticLabel()` --calls--> `normalizeSpace()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 7 → community 6_
- `currentChatHeaderTitle()` --calls--> `normalizeSpace()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 7 → community 8_
- `currentChatHeaderTitle()` --calls--> `cleanChatTitle()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 3 → community 8_
- `applyPrefix()` --calls--> `withPrefix()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 12 → community 1_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (21): captureNativeSections(), collectSidebarChats(), discoverChatRows(), getChatViewport(), hasChatHoverAction(), hasFocusedTextEntry(), isEditableTarget(), isRadarOverlayOpen() (+13 more)

### Community 1 - "Community 1"
Cohesion: 0.2
Nodes (16): activateNativeChat(), applyPrefix(), assertRuntimeActive(), dismissNativeMenu(), findChatRow(), nativeNavigationAtHome(), nextFrame(), openCurrentNativeActions() (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.16
Nodes (4): frame(), isVisible(), nativeRenameInput(), scheduleBrowserTabTitleSync()

### Community 3 - "Community 3"
Cohesion: 0.21
Nodes (13): assertChatTitle(), chatIdentity(), chatTitle(), cleanChatTitle(), deleteChat(), getActiveChatTitleForBrowserTab(), nativeChatRecord(), pinnedBetweenSections() (+5 more)

### Community 4 - "Community 4"
Cohesion: 0.23
Nodes (12): button(), closeRowMenu(), configurePreferences(), filteredChats(), isShortcut(), openRowMenu(), parseShortcut(), protectManagedSurface() (+4 more)

### Community 5 - "Community 5"
Cohesion: 0.2
Nodes (12): applyPrefixToSelectedChats(), deleteSelectedChats(), later(), nativeDeleteConfirmAction(), nativeDeleteDialog(), nativeDeleteDialogOpen(), openCatalogueChat(), queueFromSelection() (+4 more)

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (7): detectRadarOverlay(), every(), installRadarProtection(), loadPreferences(), refreshRadarOverlayState(), savePreferences(), semanticLabel()

### Community 7 - "Community 7"
Cohesion: 0.38
Nodes (7): canActivateDeleteCandidate(), isFlutterChatRow(), isHoverActionLabel(), isMenuButtonLabel(), isNavigationActionLabel(), normalizeSpace(), radarTargetKind()

### Community 8 - "Community 8"
Cohesion: 0.29
Nodes (7): currentChatHeaderTitle(), semanticButton(), semanticButtons(), visibleMenuAction(), visibleMenus(), visibleSaveAction(), visibleSemanticMenuAction()

### Community 9 - "Community 9"
Cohesion: 0.33
Nodes (6): boot(), enableFlutterSemantics(), installBrowserTabTitleSync(), installKeyboardShortcuts(), installSidebarWheelGuard(), installStyles()

### Community 10 - "Community 10"
Cohesion: 0.5
Nodes (4): catalogueView(), chatMatchesFilter(), filterChats(), normalizeEmoji()

### Community 11 - "Community 11"
Cohesion: 0.83
Nodes (3): evaluate(), send(), waitForState()

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (3): configuredPrefixes(), stripManagedPrefix(), withPrefix()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mountControls()` connect `Community 0` to `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 9`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `syncNativeSidebarLayout()` connect `Community 0` to `Community 1`, `Community 2`, `Community 4`, `Community 8`, `Community 9`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `normalizeSpace()` connect `Community 7` to `Community 8`, `Community 2`, `Community 3`, `Community 6`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
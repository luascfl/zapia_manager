# Graph Report - zapia_manager  (2026-10-17)

## Corpus Check
- 3 files · ~17,618 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 132 nodes · 308 edges · 12 communities detected
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

## God Nodes (most connected - your core abstractions)
1. `mountControls()` - 18 edges
2. `syncNativeSidebarLayout()` - 13 edges
3. `renderManagerPanel()` - 12 edges
4. `normalizeSpace()` - 11 edges
5. `deleteChat()` - 10 edges
6. `boot()` - 10 edges
7. `waitFor()` - 8 edges
8. `activateNativeChat()` - 8 edges
9. `applyPrefix()` - 8 edges
10. `scanAllChats()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `semanticLabel()` --calls--> `normalizeSpace()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 1 → community 0_
- `getActiveChatTitleForBrowserTab()` --calls--> `cleanChatTitle()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 1 → community 3_
- `applyPrefix()` --calls--> `withPrefix()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 10 → community 2_
- `configurePreferences()` --calls--> `shortcutLabel()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 8 → community 4_
- `savePreferences()` --calls--> `loadPreferences()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 7 → community 4_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (27): captureNativeSections(), collectSidebarChats(), discoverChatRows(), findChatRow(), getChatViewport(), hasChatHoverAction(), hasFocusedTextEntry(), isEditableTarget() (+19 more)

### Community 1 - "Community 1"
Cohesion: 0.15
Nodes (19): assertChatTitle(), canActivateDeleteCandidate(), chatIdentity(), chatTitle(), cleanChatTitle(), currentChatHeaderTitle(), deleteChat(), isFlutterChatRow() (+11 more)

### Community 2 - "Community 2"
Cohesion: 0.17
Nodes (17): activateNativeChat(), applyPrefix(), assertRuntimeActive(), dismissNativeMenu(), nextFrame(), openCurrentNativeActions(), openNativeActions(), rowMenuButton() (+9 more)

### Community 3 - "Community 3"
Cohesion: 0.15
Nodes (6): frame(), getActiveChatTitleForBrowserTab(), isVisible(), nativeRenameInput(), scheduleBrowserTabTitleSync(), syncBrowserTabTitle()

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (16): button(), catalogueView(), chatMatchesFilter(), closeRowMenu(), configurePreferences(), filterChats(), filteredChats(), normalizeEmoji() (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.28
Nodes (9): applyPrefixToSelectedChats(), deleteSelectedChats(), later(), openCatalogueChat(), queueFromSelection(), runChatAction(), runCurrentChatShortcut(), scheduleChatRescan() (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (6): boot(), enableFlutterSemantics(), installBrowserTabTitleSync(), installKeyboardShortcuts(), installSidebarWheelGuard(), installStyles()

### Community 7 - "Community 7"
Cohesion: 0.4
Nodes (5): detectRadarOverlay(), every(), installRadarProtection(), loadPreferences(), refreshRadarOverlayState()

### Community 8 - "Community 8"
Cohesion: 0.5
Nodes (4): isShortcut(), parseShortcut(), shortcutLabel(), shortcutValidationError()

### Community 9 - "Community 9"
Cohesion: 0.83
Nodes (3): evaluate(), send(), waitForState()

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (3): configuredPrefixes(), stripManagedPrefix(), withPrefix()

### Community 11 - "Community 11"
Cohesion: 0.67
Nodes (3): nativeDeleteConfirmAction(), nativeDeleteDialog(), nativeDeleteDialogOpen()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mountControls()` connect `Community 0` to `Community 1`, `Community 3`, `Community 4`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `syncNativeSidebarLayout()` connect `Community 0` to `Community 2`, `Community 3`, `Community 4`, `Community 6`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `renderManagerPanel()` connect `Community 4` to `Community 0`, `Community 3`, `Community 5`, `Community 6`, `Community 8`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
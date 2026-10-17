# Graph Report - zapia_manager  (2026-10-17)

## Corpus Check
- 3 files · ~15,030 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 112 nodes · 240 edges · 12 communities detected
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
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]

## God Nodes (most connected - your core abstractions)
1. `mountControls()` - 17 edges
2. `scanAllChats()` - 11 edges
3. `normalizeSpace()` - 10 edges
4. `boot()` - 9 edges
5. `applyPrefix()` - 8 edges
6. `discoverChatRows()` - 7 edges
7. `findChatRow()` - 7 edges
8. `renderManagerPanel()` - 7 edges
9. `waitFor()` - 6 edges
10. `runChatAction()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `chatIdentity()` --calls--> `normalizeSpace()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 3 → community 1_
- `semanticLabel()` --calls--> `normalizeSpace()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 3 → community 8_
- `scanAllChats()` --calls--> `mergeChatList()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 0 → community 1_
- `waitFor()` --calls--> `assertRuntimeActive()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 1 → community 4_
- `runChatAction()` --calls--> `assertRuntimeActive()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 1 → community 6_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (17): boot(), enableFlutterSemantics(), hasChatHoverAction(), hasFocusedTextEntry(), hasNativeChatMenu(), installBrowserTabTitleSync(), installKeyboardShortcuts(), installStyles() (+9 more)

### Community 1 - "Community 1"
Cohesion: 0.19
Nodes (16): assertRuntimeActive(), chatIdentity(), collectSidebarChats(), discoverChatRows(), findChatRow(), getChatViewport(), nextFrame(), pruneSelection() (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (5): isVisible(), nativeDeleteConfirmAction(), nativeDeleteDialog(), nativeDeleteDialogOpen(), nativeRenameInput()

### Community 3 - "Community 3"
Cohesion: 0.22
Nodes (11): canActivateDeleteCandidate(), chatTitle(), cleanChatTitle(), getActiveChatTitleForBrowserTab(), isFlutterChatRow(), isHoverActionLabel(), isMenuButtonLabel(), isNavigationActionLabel() (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.27
Nodes (11): applyPrefix(), configuredPrefixes(), deleteChat(), openCurrentNativeActions(), openNativeActions(), rediscoverAndDelete(), rowMenuButton(), setInputValue() (+3 more)

### Community 5 - "Community 5"
Cohesion: 0.24
Nodes (10): button(), configurePreferences(), filterChats(), filteredChats(), isShortcut(), parseShortcut(), renderManagerPanel(), shortcutLabel() (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.32
Nodes (8): applyPrefixToSelectedChats(), deleteSelectedChats(), later(), queueFromSelection(), runChatAction(), runCurrentChatShortcut(), scheduleChatRescan(), toast()

### Community 7 - "Community 7"
Cohesion: 0.29
Nodes (7): semanticButton(), semanticButtons(), semanticMenuButton(), visibleMenuAction(), visibleMenus(), visibleSaveAction(), visibleSemanticMenuAction()

### Community 8 - "Community 8"
Cohesion: 0.29
Nodes (7): detectRadarOverlay(), every(), installRadarProtection(), loadPreferences(), refreshRadarOverlayState(), savePreferences(), semanticLabel()

### Community 9 - "Community 9"
Cohesion: 0.83
Nodes (3): evaluate(), send(), waitForState()

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (2): chatMatchesFilter(), normalizeEmoji()

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (2): frame(), scheduleBrowserTabTitleSync()

## Knowledge Gaps
- **Thin community `Community 11`** (2 nodes): `chatMatchesFilter()`, `normalizeEmoji()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (2 nodes): `frame()`, `scheduleBrowserTabTitleSync()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mountControls()` connect `Community 0` to `Community 1`, `Community 2`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `scanAllChats()` connect `Community 1` to `Community 0`, `Community 2`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `normalizeSpace()` connect `Community 3` to `Community 8`, `Community 1`, `Community 2`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
# Graph Report - zapia_manager  (2026-10-17)

## Corpus Check
- 2 files · ~13,025 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 83 nodes · 172 edges · 11 communities detected
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

## God Nodes (most connected - your core abstractions)
1. `mountControls()` - 14 edges
2. `normalizeSpace()` - 10 edges
3. `applyPrefix()` - 9 edges
4. `waitFor()` - 7 edges
5. `boot()` - 7 edges
6. `deleteChat()` - 6 edges
7. `renderManagerPanel()` - 6 edges
8. `semanticButtons()` - 5 edges
9. `openNativeActions()` - 5 edges
10. `queueFromSelection()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `chatIdentity()` --calls--> `normalizeSpace()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 5 → community 1_
- `semanticLabel()` --calls--> `normalizeSpace()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 5 → community 7_
- `applyPrefix()` --calls--> `withPrefix()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 9 → community 2_
- `mountControls()` --calls--> `enableFlutterSemantics()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 6 → community 0_
- `applyPrefix()` --calls--> `visibleSaveAction()`  [EXTRACTED]
  zapia-manager.user.js → zapia-manager.user.js  _Bridges community 4 → community 2_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.18
Nodes (14): applyPrefixToSelectedChats(), discoverChatRows(), getChatViewport(), hasChatHoverAction(), hasFocusedTextEntry(), isEditableTarget(), isRadarOverlayOpen(), mountControls() (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.2
Nodes (12): button(), chatIdentity(), cleanChatTitle(), configurePreferences(), describeRow(), getActiveChatTitleForBrowserTab(), isShortcut(), parseShortcut() (+4 more)

### Community 2 - "Community 2"
Cohesion: 0.31
Nodes (11): applyPrefix(), deleteChat(), openCurrentNativeActions(), openNativeActions(), rediscoverAndApply(), rediscoverAndDelete(), rowMenuButton(), runCurrentChatShortcut() (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.22
Nodes (2): loadPreferences(), savePreferences()

### Community 4 - "Community 4"
Cohesion: 0.22
Nodes (9): hasNativeChatMenu(), semanticButton(), semanticButtons(), semanticMenuButton(), syncPanelWithNativeMenu(), visibleMenuAction(), visibleMenus(), visibleSaveAction() (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.38
Nodes (7): canActivateDeleteCandidate(), isFlutterChatRow(), isHoverActionLabel(), isMenuButtonLabel(), isNavigationActionLabel(), normalizeSpace(), radarTargetKind()

### Community 6 - "Community 6"
Cohesion: 0.4
Nodes (5): boot(), enableFlutterSemantics(), installBrowserTabTitleSync(), installKeyboardShortcuts(), installStyles()

### Community 7 - "Community 7"
Cohesion: 0.5
Nodes (4): detectRadarOverlay(), installRadarProtection(), refreshRadarOverlayState(), semanticLabel()

### Community 8 - "Community 8"
Cohesion: 0.5
Nodes (4): deleteSelectedChats(), nativeDeleteConfirmAction(), nativeDeleteDialog(), nativeDeleteDialogOpen()

### Community 9 - "Community 9"
Cohesion: 1.0
Nodes (3): configuredPrefixes(), stripManagedPrefix(), withPrefix()

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (2): isVisible(), nativeRenameInput()

## Knowledge Gaps
- **Thin community `Community 3`** (10 nodes): `currentChatShortcut()`, `isManagedNode()`, `zapia-manager.user.js`, `loadPreferences()`, `needsRemount()`, `requestZapiaCacheRecovery()`, `savePreferences()`, `scheduleBrowserTabTitleSync()`, `scheduleMount()`, `shortcutFromEvent()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (2 nodes): `isVisible()`, `nativeRenameInput()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mountControls()` connect `Community 0` to `Community 1`, `Community 3`, `Community 4`, `Community 6`, `Community 8`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `normalizeSpace()` connect `Community 5` to `Community 1`, `Community 3`, `Community 7`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `applyPrefix()` connect `Community 2` to `Community 9`, `Community 3`, `Community 4`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
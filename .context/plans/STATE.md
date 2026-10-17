# State

## Active milestone

Milestone 5, production English UI, continuous uninterrupted catalogue scrolling, freely scrollable non-blocking minimized panel, inline catalogue search with clear button, distraction-free row hover, safe profile spacing above native footer, and unrecoverable chat deletion recovery with sequenced confirmation, diagnostic logging and hidden-chat persistence, completed in version 0.5.14.

## Active story

US-008 completed: full English public UI localization (headers, settings dialog, filters, tooltips, batch actions, row menu, empty states, and errors); repaired minimized panel layout and wheel guard so native canvas navigation behind it remains completely accessible without blocking clicks or wheel events; bypassed automatic `scrollSidebarToTop` in layout sync while minimized so user can scroll native sidebar freely; added state equality guard (`panel.dataset.zapiaManagerState === state`) in `renderManagerPanel` so periodic background sync loops (`syncLoop`, `mountControls`, `scheduleMount`) never rebuild the DOM or replace the `.zapia-manager-chat-list` node when state has not changed, eliminating sudden scroll stutter and interruptions; handled broken/unrecoverable chats (both header timeout and unrendered chat row errors where Zapia backend yields 404 or fails to find row) by reverting active state, catching `isUnavailableChatError` outside the initial `runChatAction`, prompting with confirmation to attempt native Zapia deletion, emitting a structured diagnostic payload to `console.error` if native deletion cannot proceed, and persisting the chat in `preferences.hiddenChats` with restore controls in settings; safe bottom gutter (`safeProfileTop` and `max-height: calc(100vh - 96px)`) preventing catalogue from cutting into or overlapping native profile; fixed wheel guard event listener to use safe `pointInChatViewport` bounds; added inline catalogue search triggered by `🔍` which replaces filter chips with an inline text input, filters catalogue results live inside the Manager panel with case/accent insensitivity, transforms the button to `×` for instant query reset and closure; resolved visual spacing in header between title and loading/summary status; removed distracting native browser `title` hover tooltips on chat row titles while preserving `aria-label`; release version 0.5.14.
## Initial decisions (historical)

- Target LibreWolf, not Chromium, because Violentmonkey is the requested runtime.
- Use DOM labels and event dispatch only. Zapia’s native controls own title persistence and final deletion.
- Browser automation cannot drive LibreWolf through the Chromium-only CDP adapter. DOM fixture tests are the available automated proof until a logged-in LibreWolf session is supplied.

## Evidence

- `node --check zapia-manager.user.js` passed on 2026-09-06.
- `node --test test/zapia-manager.test.mjs` passed, 6 tests, 0 failures, on 2026-09-06.
- `graphify update .` rebuilt `.context/graphify-out` with 30 nodes and 56 edges.
- LibreWolf 142.0.1 and an enabled Violentmonkey extension are present in the default profile.

## Versão 0.5.14: Ajuste de layout sobre perfil nativo e captura abrangente de erro de chat indisponível

- Resolvido o corte do perfil nativo do Zapia: introduzida guarda de perfil seguro (`safeProfileTop` com calha padrão de 96px e `max-height: calc(100vh - 96px)` no `.zapia-manager-sidebar`), garantindo que o catálogo nunca sobreponha o rodapé/perfil mesmo quando os nós semânticos do Flutter forem reciclados.
- Resolvido o erro no console `TypeError: Cannot read properties of undefined (reading 'left')`: o listener de captura do evento wheel em `installSidebarWheelGuard` usava uma variável `viewport` não escopada; refatorado para chamar `getChatViewport()` de forma segura via helper puro `pointInChatViewport`.
- Expandido o classificador `isUnavailableChatError`: chats que o Zapia não consegue mais renderizar ou encontrar na rolagem lançam `"Zapia did not render chat [id]"`. Agora esse erro também aciona a confirmação de recuperação e, se confirmado e a exclusão nativa falhar, efetua o fallback com log de diagnóstico, persistência em `hiddenChats` e remoção do catálogo.
- Versão do userscript e export de runtime unificados em `0.5.14`.
- 39 testes automatizados Node executados e aprovados.
- Hot reload via CDP confirmou a distância de 95px entre a base do catálogo e a borda inferior da janela, mantendo o perfil visível e acessível.

- Versão 0.5.2 removeu a barreira artificial de exclusão para chats de agentes/habilidades (prefix-1).
- O menu contextual da linha (`⋯`) e a barra de ações em lote mantêm o botão "Excluir" habilitado para qualquer chat selecionado.
- A validação de exclusão exige apenas que o título do chat seja confirmado antes de acionar a ação nativa; a confirmação final permanece sob o diálogo nativo do Zapia.
- Sintaxe Node e 33 testes automatizados aprovados (`node --check zapia-manager.user.js` e `node --test test/zapia-manager.test.mjs`).
- Hot reload aplicado via CDP sem recarregar a aba autenticada do Zapia; smoke test confirmou botão "Excluir" habilitado no menu da linha para chat com emoji de agente (`🟡 Zotero`) e botão de exclusão habilitado na barra em lote com agente selecionado, sem disparar exclusão real.

## Initial validation pending (superseded below)

- Import `zapia-manager.user.js` in Violentmonkey and execute the manual browser sequence in `.context/docs/testing-strategy.md`.

## Remote sync

Local commit `b3472de` contains this story. `git push` on 2026-09-06 was rejected with `Permission denied (publickey)` for `git@github.com:luascfl/userscripts.git`; GitHub authentication is required before the local branch can be synchronized.

## Incident and repair

- At 15:39 and 15:41 on 2026-09-06, the host EarlyOOM service terminated two LibreWolf `Isolated Web Co` processes at 1,483 MiB and 1,376 MiB RSS respectively. This directly explains the crashed Zapia tab.
- [INFERENCE] The first installed userscript amplified memory usage: its body-wide `MutationObserver` responded to DOM changes made by its own toolbar rendering, creating a re-mount feedback loop.
- The repair ignores mutations whose target or changed nodes belong to Zapia Manager controls. `node --check` and seven Node contracts, including the self-mutation guard, passed after the change.
- The corrected script was opened in LibreWolf for Violentmonkey replacement. Reload the Zapia tab only after confirming that replacement.

- Screenshot evidence at 15:47 showed Zapia’s splash screen still loading while Zapia Manager rendered its zero-selection toolbar. The script now mounts no controls until a visible chat row exists, so it does not interact with Zapia during initialization.
- The observer subscription was restored after the self-mutation repair and is now both active and guarded. Eight Node contracts passed after this adjustment; Graphify rebuilt 37 nodes and 67 edges.

- Zapia’s live bootstrap documents a Flutter/CanvasKit stale-cache failure mode and serves its main bundle with a one-year immutable cache header. Version 0.1.1 runs at `document-start` once per profile, removes only Zapia’s `zapia_cache_flushed_v7` recovery marker, and lets Zapia’s own documented cache-recovery routine invalidate stale worker/cache assets and refetch its entry bundle. It does not clear authentication or arbitrary local-storage values.
- `node --check` and nine Node contracts passed for version 0.1.1. Graphify rebuilt 38 nodes and 68 edges.

## Chrome acceptance, 2026-09-06

- Version 0.1.6 discovers Flutter semantic chat rows by validating their hierarchy `row.parentElement.getAttribute('role') === 'group'` and their left coordinate `Math.abs(left - navLeft) < 5`. This structural constraint replaces the previous fractional width check, fixing both off-bounds control mounting (over the non-group Zapia Logo and User Profile nodes) and the hover disappearance bug caused by the row width shrinking to accommodate native Zapia action buttons.
- The user-created `teste` chat was renamed to `✔ teste`, selected through its checkbox, passed to the native Zapia exclusion dialog, and then deleted only after an explicit browser action on that dialog. No pre-existing chat was deleted.
- The live regression test found that `Limpar seleção` reset the internal set but left already mounted checkboxes checked. Version 0.1.4 synchronizes an existing row control with `selectedChatIds` on every mount. After a real reload, selecting and clearing `Compra mínima de USDT e taxa do Gemini` produced `afterSelect: true`, `afterClear: false`, and the toolbar returned to zero.
- `node --check zapia-manager.user.js` and `node --test test/zapia-manager.test.mjs` passed, 10 tests and 0 failures. `graphify update .` rebuilt 50 nodes and 93 edges.
- The Tampermonkey BETA dashboard at `options.html#…&nav=dashboard` confirms Zapia Manager version 0.1.4 is enabled and persistent in the connected Chrome profile. The earlier `#scripts` view was the wrong dashboard route.

## Separate manager panel, 2026-09-17

- The user rejected every per-row overlay. Version 0.2.0 removes the clipped sidebar layer and all row controls.
- A dedicated dark side panel now lists only visible semantic chat rows, with native checkboxes and bulk `✔ Prefixar`, `🟡 Prefixar`, guarded native deletion, and selection clearing. It is fixed at the page edge, outside the Canvas sidebar.
- Tampermonkey’s native save control persisted Zapia Manager 0.2.0 in the connected Chrome profile.
- Chrome DOM-fixture evidence found the three expected chat labels, no residual inline controls, a panel left edge after the sidebar’s right edge, compact row spacing, and enabled bulk actions after selecting a chat.
- The authenticated Zapia page still stayed at its bootstrap loading screen, so the live-page visual acceptance cannot yet be observed. `node --test test/zapia-manager.test.mjs` passed, 10 tests and 0 failures.
- `node --check zapia-manager.user.js` passed. `graphify update .` reported a 50-node, 98-edge, 8-community code graph and warned that its incremental graph was smaller than the existing 57-node graph, so it refused that overwrite.

## Collapsible manager panel, 2026-09-17

- Version 0.2.1 adds `Minimizar` to the manager header. It replaces the panel with a 113 px `Gerenciar chats` launcher at the lower page edge and restores the visible chat list and actions on activation.
- Tampermonkey’s native save control persisted 0.2.1. An isolated Chrome fixture verified collapse, no residual chat options in the launcher, fixed positioning, compact width, and full expansion back to two detected chat rows.

## Selected action repair, 2026-09-17

- Live user evidence showed `deletionQueue is not defined` when invoking `✔ Prefixar` or `Abrir exclusão nativa`. Version 0.2.2 initializes that queue before the selected-chat action paths execute.
- Tampermonkey saved 0.2.2. A Chrome end-to-end DOM fixture selected one chat, saved the native rename as `✔ Alice`, then opened a native deletion dialog while preserving `finalDeletionClicks: 0`.
- `node --check zapia-manager.user.js` and `node --test test/zapia-manager.test.mjs` passed, 10 tests and 0 failures. The currently attached persistent profile had no live Zapia page to refresh.

## Native Flutter menu repair, 2026-09-17

- User evidence after the 0.2.2 refresh showed `Zapia did not render the native rename action`, while the opened Zapia menu visibly contained Renomear and Excluir.
- Direct CDP inspection found each menu action as a visible `flt-semantics[role="button"]` whose immediate parent is `flt-semantics[role="group"]`. The former sibling-count constraint rejected this valid menu.
- Version 0.2.3 removes only that invalid sibling-count constraint. Tampermonkey saved 0.2.3. An end-to-end semantic-menu fixture saved `✔ Alice`, opened the native delete dialog, and made zero final-delete clicks.

## Native menu button repair, 2026-09-17

- User evidence showed prefixing opened `Informações do chat` instead of the more-actions menu. The previous menu-button pattern matched the substring `ações` within `Informações`.
- Version 0.2.4 now accepts exact menu labels only, including `Mais ações`, `Options`, and `Menu`. It cannot select `Informações do chat`.
- Tampermonkey saved 0.2.4. A Chrome fixture with both native buttons saved `✔ Alice` through Renomear while recording `infoClicks: 0`. `node --check` and 11 Node tests passed.

## Multi-chat prefix repair, 2026-09-17

- User reported that a single selected chat worked while multiple selections did not. The loop clicked native save and immediately targeted the next Flutter row, which can still be transient after the preceding dialog closes.
- Version 0.2.5 waits for each native rename dialog to close, then re-discovers the next queued semantic chat row instead of using a fixed 300 ms retry. It also labels the guarded deletion button as the next of the remaining selected chats, because it deliberately presents one native destructive dialog at a time.
- Tampermonkey saved 0.2.5. A Chrome fixture selected `Alpha` and `Bravo`, saved `✔ Alpha` then `✔ Bravo`, never had more than one rename dialog at once, and returned the panel selection to zero.

## Hover and batch-dialog repair, 2026-09-17

- User reported that hovering a chat removed it from the visible panel list. Flutter replaces that row with a `Mais ações` semantic action, so version 0.2.6 holds the current panel snapshot during this transient replacement instead of re-rendering it as an incomplete list.
- User also showed only one of two selected chats prefixing, followed by `Zapia did not render the native rename dialog to close.` The old wait re-ran global input discovery and mistook the persistent message composer for the rename dialog.
- Version 0.2.7 waits only for the exact rename input it opened to detach or become hidden, then re-discovers the next chat. The delete control no longer displays the rename selection count. Tampermonkey saved 0.2.7; the two-chat Chrome fixture preserved a visible composer and saved `✔ Alpha`, then `✔ Bravo`, with one dialog at a time.

## Scoped hover repair, 2026-09-17

- User reported that the whole manager disappeared after the 0.2.7 reload. Live CDP inspection found 11 valid sidebar chat rows, but Zapia also exposes a global header `Mais ações` control.
- The unscoped hover guard mistook that header control for Flutter’s row-replacement state and skipped every panel render. Version 0.2.8 accepts hover state only within the sidebar chat viewport.
- Tampermonkey saved 0.2.8. A live authenticated Chrome reload rendered the side panel with three visible chats, confirmed by DOM inspection and screenshot. `node --check` and 12 Node tests passed.

## Fresh header-menu batch repair, 2026-09-17

- User reported that the multiple-selection path still renamed only one chat. The prior flow clicked whichever header `Mais ações` control already existed after changing rows, so the next prefix could reopen the preceding chat’s menu.
- Version 0.2.9 records the current header action before selecting each queued row and waits for Zapia to replace it. The resulting menu action is therefore tied to the selected row, not the prior chat.
- Tampermonkey saved 0.2.9. A two-chat Chrome fixture with a persistent header-level action saved `✔ Alpha` and `✔ Bravo` in order.
- Live authenticated Chrome verification after the workstation restart selected `🟡 Zotero` and `🟡 Ifood` simultaneously. One `✔ Prefixar` action changed both visible titles to `✔ Zotero` and `✔ Ifood`, cleared the panel selection to zero, produced no error toast, and left no native dialog open.

## Confirmed native deletion, 2026-09-17

- User required the panel action to delete selected chats rather than merely expose Zapia's confirmation dialog.
- Version 0.2.11 labels the action `Excluir selecionados`. It opens Zapia's own `Excluir conversa?` dialog, finds `Excluir` only inside that dialog beside `Cancelar`, confirms it, waits for its closure, then moves to the next selected chat.
- The native dialog structure was inspected in the authenticated application. The installed panel now exposes the updated label and one-at-a-time deletion contract. No user chat was actually deleted during automated verification.

## Reused header-action deletion repair, 2026-09-17

- User reported that `Excluir selecionados` still did nothing. Live inspection showed the selected chat’s Zapia header reuses the same `Mais ações` semantic button rather than replacing it.
- Version 0.2.12 no longer waits for a different button instance. It selects the row, waits for two browser rendering frames so Flutter commits the selected chat, then uses the available header action. This fixes the stalled wait before the native deletion flow could begin.
- Tampermonkey saved 0.2.12. `node --check` and all 12 Node tests passed. The final destructive confirmation was intentionally not exercised on an unrelated visible chat.

## Route-aware deletion activation, 2026-09-17

- User reported that deletion succeeds only when its first selected chat is already open. When it must open another selected chat first, the native menu is reached before Zapia commits that route transition.
- Version 0.2.13 captures the route before selecting a row and opens `Mais ações` only after Zapia changes the route and renders its header action. For an already-open chat, the bounded fallback uses the available header action.
- An isolated authenticated Zapia tab proved the relevant transition: selecting `🟡 Zotero` changed `/chat?automatedDeletionProbe=1` to `/chat?pulsusNumber=ape@210b545a-5571-41a3-a435-82b2022ff1e1` and rendered `Mais ações`. Tampermonkey saved 0.2.13; Node syntax and 12 tests passed.

## Current-chat keyboard actions, 2026-09-17

- Version 0.2.14 adds `Alt+Shift+C` to prefix the current chat with `✔`, `Alt+Shift+Y` to prefix it with `🟡`, and `Alt+Shift+X` to delete it through the existing native confirmation path.
- The capture-phase handler accepts only those exact chords, suppresses browser/page handling only after matching, and ignores editable fields plus held-key repeats.
- Tampermonkey saved 0.2.14. Node syntax and 13 tests passed, including the accepted and rejected keyboard chords. An isolated authenticated Zapia tab opened `🟡 Zotero`; synthetic `Alt+Shift+C` was prevented and reached exactly one native-action click, intercepted before it could change data.

## Visible current-chat shortcut hint, 2026-09-17

- Version 0.2.15 adds the compact header hint `Atual: ✔ (Alt+Shift+C) · 🟡 (Alt+Shift+Y) · excluir (Alt+Shift+X)`.
- Tampermonkey saved 0.2.15. An authenticated Zapia panel screenshot confirms the hint is visible above the selectable-chat list; Node syntax and 13 tests passed.

## Anchored native menu actions, 2026-10-16

- User reported that the keyboard shortcut sometimes opens a link inside the chat. The native menu actions were located with unanchored regexes (`edit`, `remove`, `delete`) over every visible semantic button, so link or card text such as `Edital...` or a URL ending in `/edit` could match before the real menu item.
- Version 0.2.26 matches only the exact labels `Renomear`/`Rename` and `Excluir`/`Delete`, and takes the last match (the menu overlay is the most recent node). The now-unused `EDIT_PATTERN` is removed. A regression test covers `Edital...`, a `/edit` URL and a long sentence containing `excluir`.
- The cause is inferred from the code: it could not be reproduced live because the restarted automation Chrome had no Zapia Manager installed and an empty chat list. Syntax check and 16 Node tests passed.

## Live link-opening investigation, 2026-10-17

- Automated in a persistent Chrome (CDP, current source injected). Across 15 chats the semantic tree exposed exactly one `Mais ações` (the header) and no link nodes; chat links are canvas-drawn, so the script cannot click them. Every `.click()` in the script targets a placeholder, a sidebar row, a menu item or a dialog button.
- Alt+C (synthetic and trusted CDP key events) in 5 chats clicked only `Mais ações` then `Renomear`; no `window.open`, no new tab, no route change. The final `Renomear` click was blocked by a spy, so no chat was renamed.
- Not reproduced: message bodies did not render in this Chrome (empty canvas), so the user's case with a link in the message area remains unconfirmed. The anchored-label fix in 0.2.26 stays as hardening.
- Verified defects seen along the way: the sidebar promo `Ganhe o Zapia Pro de graça` is listed as a chat in the manager panel, and the manager panel sits exactly where Zapia's native chat menu opens (top right), hiding it.

## Milestone 2 bootstrap and US-002, 2026-10-17

- Layout check (`workflow_stack layout`) was clean: no legacy dirs. `pick_story` found no open story (US-001 passed), so Milestone 2 was added to `ROADMAP.md` with US-002..US-004 in `prd.json`. US-001 acceptance criteria were rewritten to match reality (configurable emojis and chords, confirmed native deletion).
- US-002 done in 0.2.27: `Ganhe o Zapia Pro de graça` (with or without `Nova função disponível`) is treated as navigation by `isNavigationActionLabel` and by the viewport-top calculation. A look-alike chat title (`Ganhe tempo com o Zapia Pro`) stays a chat. Evidence: `node --check`, 17 Node tests pass; live authenticated Chrome (source injected over CDP) showed the banner in the sidebar and 8 real chats, no banner, in the panel list.
- Stale statements that the script never confirms deletion were fixed in `PROJECT.md`, `ROADMAP.md`, `workflow/README.md`, `docs/project-overview.md` and `docs/testing-strategy.md`. `phase-1/PLAN.md` is historical and unchanged.
- Skill: CDP testing playbook for Flutter SPAs added to the `browser-automation` hub as `references/flutter-canvas-spa-cdp-testing.md`.
- Next: US-003 (panel covers the native chat menu). US-004 stays blocked on a user repro.

## US-003 panel vs native menu, 2026-10-17

- 0.2.28: `syncPanelWithNativeMenu` runs at the start of every `mountControls`; while `hasNativeChatMenu` finds an exact `Renomear` node whose parent has `role=group`, the panel gets `is-native-menu-open` (hidden, non-interactive). It is restored when the menu closes. Impact via Graphify: only `mountControls`, `semanticButtons`, `semanticLabel` are touched.
- Evidence: `node --check`, 18 Node tests; live Chrome over CDP with a real mouse click on the header menu: menu fully visible and panel hidden (screenshot), then panel visible again after clicking outside (screenshot). Synthetic `Escape` does not close Zapia's popup; use a real click outside.
- Observed for US-004: message bodies now render in the automation Chrome and one chat contains a link; a repro with the shortcut can be attempted next.

## US-005: catálogo completo, filtros e troca rápida do código, 2026-10-17

- Versão 0.3.0: catálogo em memória obtido rolando a barra lateral nativa nos dois sentidos. Títulos completos ficam no DOM, pesquisáveis mesmo abaixo do viewport do painel. Filtros por `[número]` e pelos dois emojis configurados usam OR; trocar filtro remove seleções ocultas.
- A ordem visual dos nós precisa ser reconstruída por posição: Flutter recicla elementos e a ordem do DOM não acompanha a lista. A coleta também exclui notificações, Radar com contador, banners e ações de hover. A identidade deixa de incluir o contador de mensagens não lidas.
- Pedido adicional do usuário: evitar recarregar a página a cada teste. Comando canônico: `node scripts/reload-userscript.mjs`. Valida a sintaxe e substitui somente o userscript no alvo CDP; preserva catálogo, filtros, seleção, estado recolhido e rolagem. `--target ID` resolve múltiplas abas. `--migrate` só é necessário uma vez para instâncias antigas sem descarte de recursos.
- A instância substituída aborta listeners de documento, cancela timers/frames e esperas pendentes, desconecta observers e remove só seus controles/estilo. Uma ação nativa em curso bloqueia a troca; uma varredura pode ser cancelada preservando o catálogo completo anterior. O painel restaurado reaparece mesmo com hover na barra.
- Evidências: sintaxe dos dois arquivos e 23 testes Node passaram. Atualização explícita encontrou 113 ids únicos em 12.786 s; filtros resultaram em 5 numerados, 56 com emoji 1 e 24 com emoji 2. `window.find` encontrou título fora da área visível do painel; a barra nativa de Ctrl+F não foi inspecionada.
- Trocas de código observadas sem navegação nem nova varredura: 46–633 ms; última troca em 57 ms. Preservação de filtro, seleção e scroll verificada; instância antiga ficou com zero recursos; uma única instância de painel, estilo e listener de atalho permaneceu. Cancelamento de scan não gerou rejeições não tratadas.
- Um chat inicialmente fora da tela foi localizado e aberto; a ação alcançou seu diálogo de renomeação. O botão nativo de salvar foi interceptado e o diálogo cancelado, sem alteração persistida. O timeout de fechamento observado nesse teste foi consequência deliberada do bloqueio de salvar.
- Correção necessária para essa ação: `semanticMenuButton` agora exclui a navegação lateral. O teste encontrou dois `Mais ações`, um deles de hover na barra. Isso corrige o alvo errado observado, mas não comprova a causa do link abrindo da US-004.
- Evidência sanitizada local: `.context/workflow/ralph/evidence/us-005.json` (diretório ignorado pelo Git por convenção). Documentação técnica e workflow atualizados. O comando injeta na aba atual, não instala a versão em Tampermonkey/Violentmonkey.
- Fechamento: `graphify update .` gerou 112 nós e 240 relações. Procedimento de teste rápido incorporado ao arquivo existente `flutter-canvas-spa-cdp-testing.md` do hub gerenciado `browser-automation`, sem criar skill ou script auxiliar paralelo. Capturas temporárias do teste removidas; comando final em `scripts/reload-userscript.mjs`. Reviews não enviados: CLI e tentativa HTTP de agent.reviews expiraram.


## US-006: integração na barra lateral, 2026-10-17

- O usuário aprovou substituir visualmente a área da lista Canvas por uma lista DOM integrada; não houve alteração dos componentes internos do Flutter. Versão 0.4.0 remove painel flutuante, minimização e launcher.
- A superfície `Conversas` acompanha os limites da barra nativa, abaixo da navegação principal e acima do perfil. Títulos abrem os chats nativos; ⋯ abre o menu correspondente. As ações em lote aparecem somente quando existe seleção.
- Reutilizados catálogo completo, filtros por id/emojis, configurações e atalhos. Eventos de ponteiro/roda nos controles gerenciados não vazam para o Canvas. A navegação de origem volta ao topo depois de revelar um chat, inclusive quando a ação falha.
- Smoke autenticado: 113 chats; filtros com 5, 56 e 24 resultados; `window.find` alcançou título fora da área visível; checkbox e configuração não mudaram a rota. Abertura de chat distante mudou a rota e restaurou a navegação. Busca nativa ocultou a lista integrada e ela voltou ao fechar a busca.
- O teste encontrou um menu nativo que permanecia aberto ao trocar de chat. A correção dá foco à ação nativa, espera dois frames de renderização e envia Escape antes da navegação. O cenário passou após a correção. Limites medidos: x=0..280, y=286..762,667; menu nativo à direita visível sem sobreposição. Captura visual confirmada.
- `node --check zapia-manager.user.js` e os 25 testes Node passaram. Iteração pelo comando existente, sem recarregar documento nem repetir varredura; trocas finais em 88–262 ms.
- Tampermonkey não tinha Zapia Manager neste perfil. Foi salva uma única instalação 0.4.0 depois do smoke. Dashboard recarregado/editor reaberto: código persistido idêntico ao arquivo validado. Nova abertura de Zapia, sem injeção, carregou automaticamente 0.4.0, 113 chats, uma barra integrada e nenhum erro de página; menu nativo novamente visível sem sobreposição.
- Nenhum chat foi renomeado ou excluído neste ciclo. Próximo trabalho continua US-004; os critérios antigos não foram declarados resolvidos pela nova interface.
- Fechamento: `graphify update .` atualizou o grafo de código para 119 nós, 267 relações e 10 comunidades. Evidência sanitizada em `.context/workflow/ralph/evidence/us-006.json`, ignorada pelo Git.
- Reutilizado o comando final `scripts/reload-userscript.mjs`; nenhum script auxiliar paralelo foi criado. Procedimento de foco/Escape e validação da instalação incorporado à referência existente `flutter-canvas-spa-cdp-testing.md` do hub gerenciado `browser-automation`.
- Capturas temporárias deste smoke, com conteúdo pessoal, removidas após inspeção visual. Busca em `./tmp` e nos temporários nomeados para esta story não encontrou outros auxiliares; artefatos antigos ou ambíguos não foram apagados.

## US-004 atalho e link, 0.5.15, 2026-10-17

- Tentativa de repro no Chrome persistente (CDP), num chat com cards de link, com eventos reais de `Alt+C` e `Alt+V` e spies em `window.open`, `history.pushState` e cliques: os cliques foram só para `Mais ações` do cabeçalho, `Renomear` nativo e `OK` do diálogo. Sem `window.open`, sem navegação, sem erros. O caso do usuário não foi reproduzido, então a US-004 continua aberta.
- Estrutura observada: o `Mais ações` do cabeçalho divide o pai com o botão do título do chat (sem `role=group`); cards de mensagem e botões de link ficam dentro de nós `role=group`.
- Endurecimento na 0.5.15: `semanticMenuButton` exige a faixa do cabeçalho pelo helper puro `isChatHeaderControl` (pai sem `role=group`, à direita da barra lateral, topo entre 0 e 70). Um botão isca `Mais ações` na área de mensagens, antes do real na ordem do DOM, foi ignorado e o clique foi para o botão do cabeçalho. Que essa seja a causa do usuário é [INFERENCE].
- Clique ainda sem âncora: `visibleSaveAction` recorre a qualquer botão semântico com rótulo exato Salvar, Save, Confirmar, Confirm ou OK.
- Acidente no repro: um `Alt+C` sem bloqueio renomeou o chat de produção `🟡 Resumos de grupos do Whatsapp` para `✔ ...`. Foi revertido com `Alt+V` e o título original foi confirmado. Nas execuções seguintes o spy bloqueia o salvar final.
- Evidências: `node --check` e 40 testes Node passaram (novo teste de `isChatHeaderControl`). O Tampermonkey Beta salvou a 0.5.15 e o dashboard recarregado mostra 0.5.15. Uma página nova de `app.zapia.com/chat`, sem injeção, carregou a 0.5.15 com um painel e um estilo.

# UI Refactoring Proposal: Gaming Page

## Scope
This proposal focuses on the multiplayer gaming UI centered around:
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx`
- Related UI components in `packages/web/src/components/` (`NextPiecePanel`, `TouchControls`, `PostMatchScreen`, `PartykitMatchmaking`, debug/notification components)

Goal: split the current monolith into focused, testable, reusable UI modules without changing gameplay behavior.

## Current Structure (Observed)

### Entry and routing
- `packages/web/src/App.tsx` routes `mode === 'multiplayer'` directly to `ServerAuthMultiplayerGame`.

### Core game screen
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx` is very large (~2125 LOC) and currently owns:
1. Network client lifecycle (`ServerAuthGameClient` connection/disconnection)
2. Authoritative state sync (`yourState`, `opponentState`)
3. Ability request/response orchestration
4. Board render orchestration (two `TetrisRenderer` instances)
5. FX orchestration (screen shake, flash, particle events, board diffs, timed effect bars)
6. Input handling (keyboard + touch)
7. Audio/haptics integration
8. Match-end flow (winner handling, rewards, end modal)
9. Debug mode and debug panel wiring
10. Full page layout and all inline styling

### Related components
- `packages/web/src/components/NextPiecePanel.tsx`: focused and reusable canvas panel.
- `packages/web/src/components/Notification.tsx`: reusable notification element used by the game.
- `packages/web/src/components/TouchControls.tsx`: currently unused by multiplayer page.
- `packages/web/src/components/PostMatchScreen.tsx`: currently unused by multiplayer page.
- `packages/web/src/components/PartykitMatchmaking.tsx`: separate flow screen, similar visual style but independent implementation.

## Pain Points

1. Single-component overload
- `ServerAuthMultiplayerGame.tsx` mixes transport, state orchestration, game logic side-effects, and rendering in one file.
- Result: high cognitive load, difficult debugging, high risk when changing unrelated UI behavior.

2. Tight coupling between effects and rendering
- Board-diff FX, ability notifications, audio/haptics, and renderer calls are interleaved.
- Difficult to test or replace one effect pipeline without touching core rendering flow.

3. Inline-style sprawl
- Heavy inline style usage (`style={{ ... }}` appears extensively) causes repetition and makes visual consistency updates expensive.
- Prevents tokenized styling/theme-level overrides for game sub-areas.

4. Duplicated/parallel UI patterns
- Touch controls and end-of-match UI are implemented inside `ServerAuthMultiplayerGame` while standalone components (`TouchControls`, `PostMatchScreen`) exist but are unused.
- Increases drift and maintenance overhead.

5. Weak type boundaries
- Extensive `any` usage in state/board helpers and effect payloads reduces compiler protection.
- Increases regression risk while refactoring.

6. Unclear module ownership
- No dedicated `game/` component subtree for multiplayer UI.
- Hard for contributors to discover where HUD, boards, overlays, and controls belong.

7. Ref dependency pressure in one place
- Many refs/timeouts/maps for pending ability events and animation scheduling are managed inside one component.
- Higher chance of lifecycle bugs and stale closure issues.

## Proposed Target Architecture

## Design principles
1. Keep `ServerAuthMultiplayerGame` as a thin orchestration shell.
2. Move rendering sections into presentational components.
3. Move side-effect orchestration into custom hooks.
4. Consolidate shared game-screen styles via CSS module(s) + tokens.
5. Replace `any` with typed view models adapted from server state.

## Recommended folder structure

```text
packages/web/src/components/game/
  multiplayer/
    ServerAuthMultiplayerGame.tsx        # thin container/composition
    MultiplayerGameLayout.tsx            # page/frame layout
    MultiplayerHud.tsx                   # timed effects + stats rows
    PlayerBoardPanel.tsx                 # your board + next panel + own overlays
    OpponentBoardPanel.tsx               # opponent board + compact stats
    AbilityDock.tsx                      # ability buttons list
    GameTouchControls.tsx                # extracted touch controls (replace inline)
    GameEndModal.tsx                     # extracted end modal (or wrap PostMatchScreen)
    overlays/
      AbilityNotifications.tsx
      DefensiveIndicator.tsx
      StarPopups.tsx
      ConnectionBadge.tsx
    hooks/
      useServerAuthGameSession.ts        # client connect/state lifecycle
      useBoardRenderers.ts               # canvas/renderer setup + render loop bridge
      useAbilityPipeline.ts              # request/response/pending notifications
      useGameplayEffects.ts              # flash/shake/particles/timed effects derivation
      useGameInput.ts                    # keyboard + pointer input bindings
    styles/
      multiplayer-game.css               # scoped class-based styling + CSS variables
    types/
      gameViewModels.ts                  # typed UI view models derived from server state
```

## Responsibility split (important)
- Container (`ServerAuthMultiplayerGame`): wiring hooks and composition only.
- Hooks: imperative integration (client, renderer, input, audio/haptics, timeouts).
- Components: pure props in, JSX out.
- `types/gameViewModels.ts`: single adaptation boundary from raw server state -> UI-safe typed models.

## Refactoring plan (phased, low-risk)

### Phase 1: Structural extraction without behavior change
1. Create `components/game/multiplayer/` subtree.
2. Move end modal JSX into `GameEndModal`.
3. Move touch-controls JSX into `GameTouchControls`.
4. Move ability list block into `AbilityDock`.
5. Move connection badge and notifications stack into overlay components.

Acceptance: identical behavior/visuals, smaller main file.

### Phase 2: Hook extraction
1. Extract `useGameInput` (keyboard + touch handlers).
2. Extract `useAbilityPipeline` (activation, result handling, timeouts, notification queue).
3. Extract `useGameplayEffects` (line clear effects, star popup triggers, flash/particles/screen-shake state).
4. Extract `useServerAuthGameSession` (connect/disconnect, state updates, winner state, connection stats).

Acceptance: `ServerAuthMultiplayerGame.tsx` mostly composition + prop plumbing.

### Phase 3: Renderer boundary and typed view-model layer
1. Extract canvas setup/render logic into `useBoardRenderers` and board panel components.
2. Define concrete interfaces for `yourState`/`opponentState` view models and replace `any`.
3. Centralize board-diff utility and ability-effect mapping in a dedicated `effects` helper module.

Acceptance: improved type safety and easier renderer/effect evolution.

### Phase 4: Styling cleanup and reuse
1. Replace large inline style blocks with class-based styles in `styles/multiplayer-game.css`.
2. Introduce scoped CSS variables for repeated colors, shadows, radii, spacing.
3. Unify visual primitives used by game/matchmaking/post-match screens (glass card, neon badge, control button).

Acceptance: consistent visual language and faster UI iteration.

## Concrete Immediate Wins

1. Reuse or replace dead components intentionally
- Either integrate existing `TouchControls`/`PostMatchScreen` into multiplayer flow or remove them.
- Avoid maintaining two implementations for the same UI concept.

2. Add a typed adapter function
- Example: `toGameViewModel(state: GameStateUpdate['yourState'])`.
- Keeps server payload shape from leaking throughout the UI.

3. Consolidate ability effect metadata
- Today effect rendering logic is spread between helpers and inline branches.
- Introduce one config map (`abilityType -> visual/audio/effect policy`) to reduce conditional complexity.

4. Isolate debug wiring
- Keep debug panel mount + debug logger in dedicated hook/component; avoid mixing with gameplay render tree.

## Risks and Mitigations

1. Risk: behavior regressions in effect timing
- Mitigation: extract with snapshot-based checks and manual scripted playthroughs (line clear, bomb, shield/reflect, timed effects).

2. Risk: input latency regressions
- Mitigation: keep input send path unchanged initially; refactor handler location only.

3. Risk: visual drift during style extraction
- Mitigation: phase style migration area-by-area and compare before/after screenshots for key breakpoints.

## Validation checklist

1. Multiplayer match renders both boards, next piece, stats, abilities.
2. Keyboard and touch inputs still send expected server inputs.
3. Ability activation success/reject paths still show correct notification/audio.
4. Board-diff effects (bomb and cell-manip abilities) still trigger.
5. Debug mode (`?debug=true`) still opens panel and logs events.
6. End-of-match flow still shows outcome + rewards and exits cleanly.
7. Mobile viewport keeps controls usable and non-overlapping.

## Summary Recommendation
Refactor `ServerAuthMultiplayerGame` into a composition shell plus focused hooks/components under a dedicated `components/game/multiplayer` module. Prioritize extraction in this order: end modal + controls + ability dock, then hooks for input/ability/effects/session, then typed view-models and style-system cleanup. This preserves behavior while materially reducing complexity and making future UI changes safer.

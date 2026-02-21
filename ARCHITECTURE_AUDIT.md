# Architecture Audit

## Active Refactor: Zone-Based Match Layout + Dynamic Board Sizing

### Goals
- Keep both normal and defense modes aligned on the same layout model.
- Make gameplay zones explicit and measurable:
  - `top-info-zone`
  - `left-info-zone`
  - `player-board-zone`
  - `right-info-zone`
  - `action-zone`
- Ensure board rendering always uses square cells and fully fits available zone space.
- Make board width changes from abilities (`narrow_escape`, `wide_load`) render correctly with server authority.

### Implemented
- Added server-authoritative board dimensions in game updates (`boardWidth`, `boardHeight`).
- Added a reusable board sizing utility:
  - `packages/web/src/components/game/boardDisplaySizing.ts`
  - Enforces square cells and fit-to-zone sizing.
  - Keeps expanded-width boards (e.g. 12 columns) from growing overall board width.
- Added a reusable element measurement hook:
  - `packages/web/src/hooks/useElementSize.ts`
- Applied dynamic zone-based board sizing in:
  - `packages/web/src/components/ServerAuthMultiplayerGame.tsx`
  - `packages/web/src/components/DefenseLineGame.tsx`
- Removed stale overlay/offset layout logic that depended on hardcoded top/middle/bottom math.
- Defense mode now follows the same zone naming and flow-based structure as normal mode (without ability bar).

### Validation
- `pnpm --filter web build` passed.
- `pnpm --filter web test -- --run` passed.
- `pnpm --filter @tetris-battle/partykit build` passed.
- `pnpm --filter @tetris-battle/partykit test -- --run` passed.

### Next Cleanup
- Consolidate shared match UI primitives to reduce duplication between normal/defense components.
- Extract a dedicated shared shell component once both mode layouts stabilize.

# Defense Line — Technical Design Document

## New Battle Mode for Tetris Battle PWA

**Version:** 0.1 Draft  
**Date:** February 20, 2026  
**Status:** Experimental

---

## 1. Overview

Defense Line is a new real-time 1v1 battle mode where two players share a single board with **inverted perspectives**. Each player drops tetriminos from their side. The board is a shared battlefield where one player's filled cells are the other player's empty space.

**Win condition:** First player to clear 10 rows.

---

## 2. Core Concept

### 2.1 The Inversion Rule

Every cell on the board has two simultaneous interpretations:

| Cell | Player A sees... | Player B sees... |
|------|------------------|------------------|
| 0-cell | empty (hole) | filled (wall) |
| x-cell | filled (wall) | empty (hole) |
| a-cell | filled (own piece) | empty (passable) |
| b-cell | empty (passable) | filled (own piece) |

This single rule produces all emergent gameplay: overwriting, tunneling, invasion, and tug-of-war over contested rows.

### 2.2 Board Structure

```
5 columns × 30 rows

Row  0  ┌─────┐  ← A spawns here (piece enters falling ↓)
...     │     │
Row 14  │     │  ← 0-background (A's home zone)
        │─────│  ← defense line (conceptual boundary)
Row 15  │     │  ← x-background (B's home zone)
...     │     │
Row 29  └─────┘  ← B spawns here (piece enters rising ↑)
```

- Rows 0–14: background = 0 (filled for B, empty for A)
- Rows 15–29: background = x (filled for A, empty for B)

### 2.3 Perspective

Each player views the board with their spawn side at the top. Both see a standard Tetris orientation — pieces fall from the top of their screen.

- **Player A's screen:** Row 0 at top, row 29 at bottom. Pieces fall downward. Opponent pieces appear to rise from below.
- **Player B's screen:** Row 29 at top, row 0 at bottom (board is rendered flipped 180°). Pieces fall downward from B's perspective. Opponent pieces appear to rise from below.

Both players experience "normal Tetris" from their own point of view.

---

## 3. Game Mechanics

### 3.1 Piece Movement & Collision

**Player A (gravity ↓):**
- Piece enters at row 0, falls toward row 29
- Passable cells: `0` (background), `b` (opponent pieces)
- Solid cells: `x` (background), `a` (own pieces)
- Overwrites `b` cells on landing

**Player B (gravity ↑):**
- Piece enters at row 29, rises toward row 0
- Passable cells: `x` (background), `a` (opponent pieces)
- Solid cells: `0` (background), `b` (own pieces)
- Overwrites `a` cells on landing

**Critical implication:** A player's pieces create passable tunnels for the opponent. The more you build, the deeper the opponent can penetrate into your zone.

### 3.2 Piece Landing

A piece lands when it cannot move further in its gravity direction on the next tick. Landing is determined by the next row containing any solid cell (for that player) in the piece's path.

Since opponent pieces are passable, a piece can fly through the entire board and land against the far wall if there are no own-pieces or own-background in the way.

### 3.3 Overwriting

When a piece lands on cells occupied by opponent pieces, those cells are replaced. This is not a special mechanic — it follows naturally from the rule that opponent pieces are "empty."

**EXAMPLE:** A has a row nearly filled

```
Board:      aaaa0     A view: a a a a [empty] → 1 hole

B drops I-piece (horizontal) into same row:

After:      bbbb0     B overwrote all of A's work.
            
            A view: [empty×4] [empty] → 5 holes
            B view: b b b b [0=filled on active row] → ALL FILLED → CLEAR ★
```

### 3.4 Row Clearing

**Active rows:** A row becomes "active" once any tetrimino piece (a or b) has been placed in it. Inactive rows (pure `0` or pure `x`) cannot be cleared — they are inert background.

- **Clear condition for Player A:** Every cell in an active row is either `a` or `x`.
- **Clear condition for Player B:** Every cell in an active row is either `b` or `0`.

Both players can clear different rows simultaneously in real-time. The same row cannot clear for both players at the same time (if all cells are `a` then it has holes for B, and vice versa).

**Clearing in enemy zone is easier:** In the 0-zone (rows 0–14), `0` counts as filled for B on active rows. B only needs to place enough pieces to make the row active; the background `0` cells count as filled. Similarly for A in the x-zone.

**Clearing in own zone is harder but safer:** A must fill all 5 columns with `a` pieces in the 0-zone (no background help). But it's closer to A's spawn, so less vulnerable to opponent overwriting.

### 3.5 Gravity After Clear

When a row clears:
- A's pieces (`a` cells) above the cleared row fall downward
- B's pieces (`b` cells) below the cleared row rise upward
- Pieces stop when they hit their respective solid cells (same rules as piece movement)

Gravity is applied per-cell, not per-piece (pieces break apart like standard Tetris).

### 3.6 Active Falling Piece Interaction

Both players have an active falling piece simultaneously. When the opponent lands a piece that overwrites cells in the path of your active piece:
- No recalculation needed — opponent pieces are always passable for your piece
- Your piece continues falling as normal
- If opponent overwrites cells where your piece would have landed, your piece simply passes through and lands further down

### 3.7 Spawn

- A spawns at row 0 (top of board, centered)
- B spawns at row 29 (bottom of board, centered)
- Since opponent pieces are passable, spawn is never blocked
- There is no top-out / game-over from blocked spawn

---

## 4. Examples

### 4.1 Basic Overwrite & Steal

**STEP 1:** A drops I-piece (horizontal) at row 14, cols 0-3

```
col:  01234
      ┌─────┐
r14   │aaaa0│  A view: a a a a [empty] → 1 hole
      │─────│
r15   │xxxxx│
      └─────┘
```

**STEP 2:** B drops I-piece (horizontal) at row 14, cols 0-3

B rises through x-zone (passable), reaches row 14.
Cols 0-3 have 'a' = passable for B. B enters and overwrites.
Row 13 cols 0-3 have '0' = WALL for B. Piece lands at row 14.

```
col:  01234
      ┌─────┐
r14   │bbbb0│  B overwrote A's entire row!
      │─────│
r15   │xxxxx│
      └─────┘

B view row 14: b b b b [0=filled, active row] → ALL FILLED → CLEAR ★

B stole A's row. A gets nothing.
```

### 4.2 Tunnel Invasion

**STEP 1:** A builds a tall column at col 4

```
col:  01234
      ┌─────┐
r10   │0000a│  
r11   │0000a│  
r12   │0000a│  
r13   │0000a│  
r14   │0000a│  All 'a' at col 4 — A is building toward a clear.
      │─────│
r15   │xxxxx│
      └─────┘
```

**STEP 2:** B drops I-piece (vertical) at col 4

```
B rises through x-zone (passable).
Row 14 col 4: 'a' = passable. ✓
Row 13 col 4: 'a' = passable. ✓
Row 12 col 4: 'a' = passable. ✓
Row 11 col 4: 'a' = passable. ✓
Row 10 col 4: 'a' = passable. ✓
Row 9 col 4: '0' = WALL for B. ✗

I-piece lands at rows 10-13, overwrites A's column.

col:  01234
      ┌─────┐
r10   │0000b│  ← B invaded through A's tunnel!
r11   │0000b│  
r12   │0000b│  
r13   │0000b│  
r14   │0000a│  ← only this cell survived (I-piece is 4 tall)
      │─────│
r15   │xxxxx│
      └─────┘

B view rows 10-13: [0] [0] [0] [0] b → ALL FILLED → CLEAR ★ (×4 rows!)

A's tall column became B's highway for a 4-row clear.
```

### 4.3 Own-Zone Clear (Hard but Safe)

A fills row 14 entirely with own pieces — no background help.

```
col:  01234
      ┌─────┐
r13   │0000a│  ← leftover from vertical I-piece
r14   │aaaaa│  ← A view: all 'a' → ALL FILLED → CLEAR ★
      │─────│
r15   │xxxxx│
      └─────┘

A scores. But the leftover at r13 col 4 is a 1-deep tunnel
for B to exploit.
```

### 4.4 Enemy-Zone Raid

B has pieces in x-zone. A falls through to exploit.

```
col:  01234
      ┌─────┐
r14   │00000│
      │─────│
r15   │bbbxx│  ← B placed pieces at cols 0-2
      └─────┘

A drops I-piece (horizontal) cols 0-3 at row 15.
Falls through 0-zone (passable). 
Row 15 cols 0-2: 'b' = passable for A. 
Row 15 col 3: 'x' = WALL. Can't pass further down.

Wait — A lands ON row 15 because row 15 itself has x-background
at cols 3-4 which is solid for A. The 'b' at cols 0-2 is passable.

So A's I-piece lands at row 15, cols 0-3. Overwrites B's pieces.

col:  01234
      ┌─────┐
r14   │00000│
      │─────│
r15   │aaaax│  A view: a a a a [x=filled] → ALL FILLED → CLEAR ★
      └─────┘

A cleared in B's zone! The x-background helped A.
```

---

## 5. Server Architecture

### 5.1 PartyKit Server

The PartyKit server is the single source of truth for all game state. Clients are render-only.

**Server responsibilities:**
- Maintain authoritative board state (5×30 grid)
- Track active rows set
- Handle piece spawning and gravity ticks
- Resolve piece placement (timestamp-based for conflicts)
- Detect and execute row clears
- Apply post-clear gravity
- Track row-clear count per player
- Detect win condition (10 clears)

**Client responsibilities:**
- Render board state (flipped 180° for Player B)
- Send player inputs (move left/right, rotate, hard drop, soft drop)
- Display ghost/preview piece based on server state
- Show opponent's active piece in real-time

### 5.2 State Model

```typescript
interface DefenseLineGameState {
  board: (null | 'a' | 'b')[][];     // 30 rows × 5 cols
  activeRows: Set<number>;            // rows with any placed piece
  
  playerA: DefenseLinePlayerState;
  playerB: DefenseLinePlayerState;
  
  status: 'waiting' | 'countdown' | 'playing' | 'finished';
  winner: 'a' | 'b' | null;
}

interface DefenseLinePlayerState {
  activePiece: {
    type: PieceName;                   // I, O, T, S, Z, L, J
    rotation: number;
    row: number;                       // top-left corner
    col: number;
  } | null;
  nextPiece: PieceName;
  rowsCleared: number;                 // first to 10 wins
  queue: PieceName[];                  // standard 7-bag
}

type PieceName = 'I' | 'O' | 'T' | 'S' | 'Z' | 'L' | 'J';
```

### 5.3 Tick Processing

Each gravity tick (use existing tick rate):

1. For each player with an active piece:
   a. Attempt to move piece one row in gravity direction
   b. If blocked (next row has solid cell for this player):
      - Lock piece: write cells to board, overwriting opponent pieces
      - Mark affected rows as active
      - Check all active rows for clears
      - If clears found:
        - Remove cleared row contents
        - Apply gravity (a-cells fall ↓, b-cells rise ↑)
        - Increment player's rowsCleared
        - Check win condition
      - Spawn next piece
   c. If not blocked: update piece position
2. Broadcast updated state to both clients

### 5.4 Conflict Resolution

Both players act simultaneously. When both pieces try to write to the same cell in the same tick:
- Server processes by timestamp (last write wins)
- In practice, this is rare — opponent pieces are passable, so both pieces can occupy overlapping positions during flight. Conflict only occurs at the exact moment of locking.

### 5.5 Message Protocol

**Client → Server:**
```typescript
type ClientMessage =
  | { type: 'move'; direction: 'left' | 'right' }
  | { type: 'rotate'; direction: 'cw' | 'ccw' }
  | { type: 'soft_drop' }
  | { type: 'hard_drop' }
  | { type: 'join'; player: 'a' | 'b' }
  | { type: 'ready' }
```

**Server → Client:**
```typescript
type ServerMessage =
  | { type: 'state'; state: DefenseLineGameState }
  | { type: 'clear'; rows: number[]; player: 'a' | 'b' }
  | { type: 'win'; winner: 'a' | 'b' }
  | { type: 'countdown'; seconds: number }
```

---

## 6. Client Rendering

### 6.1 Board Rendering

Player A sees the board as-is (row 0 at top). Player B sees the board rotated 180° (row 29 at top).

```typescript
function renderCell(row: number, col: number, board: Board, viewAs: 'a' | 'b') {
  const cell = board[row][col];
  const bg = row < 15 ? '0' : 'x';
  
  if (cell === 'a') return { color: ORANGE, type: 'piece' };
  if (cell === 'b') return { color: CYAN, type: 'piece' };
  
  // Empty cell — show zone shading
  if (bg === '0') return { color: DARK_A_ZONE };   // A's home territory
  if (bg === 'x') return { color: DARK_B_ZONE };   // B's home territory
}
```

Both players see the same colors — A's pieces are always orange, B's always cyan. The only difference is the 180° rotation.

### 6.2 Ghost Piece

Ghost piece (landing preview) is calculated per-player using their specific solid/passable rules. The ghost shows where the active piece will land.

### 6.3 Opponent's Active Piece

The opponent's active falling piece is rendered in real-time as a translucent/outlined shape. The player can see it approaching.

### 6.4 Visual Indicators

- **Defense line:** subtle divider between row 14 and row 15
- **Active rows:** slightly brighter background to indicate clearable status
- **Clear animation:** flash row on clear (existing animation)
- **Row counter:** show X/10 rows cleared for each player

---

## 7. Key Differences from Standard Mode

| Aspect | Standard Battle | Defense Line |
|--------|-----------------|--------------|
| Board | 10×20 per player (separate) | 5×30 shared |
| Gravity | Down only | Down for A, Up for B |
| Opponent pieces | Garbage rows | Passable, overwritable |
| Clearing | Fill own row | Fill row per own rules |
| Win condition | Opponent tops out | First to 10 clears |
| Spawn blocking | Causes loss | Impossible (enemy = passable) |
| Strategy | Build & clear | Offense/defense balance |

---

## 8. Entry Point

Add a "Defense Line" button alongside the existing "Play" button on the battle mode selection screen. No changes to scoring, coins, or progression — this is experimental.

```
┌──────────────────────┐
│    BATTLE MODE       │
│                      │
│   ┌──────────────┐   │
│   │     Play     │   │
│   └──────────────┘   │
│   ┌──────────────┐   │
│   │ Defense Line │  ← NEW
│   └──────────────┘   │
│                      │
└──────────────────────┘
```

---

## 9. Open Questions / Future Considerations

1. **Scoring weight:** Should enemy-zone clears count equally? They're easier (background helps). Could weight own-zone clears as 2x.

2. **Board dimensions:** 5×30 is the starting point. May need tuning after playtesting. Wider boards make clears harder; taller boards give more space before contact.

3. **Speed progression:** Currently fixed speed. Could increase after X clears to create endgame tension.

4. **Piece preview:** How many next pieces to show? Standard is 1-3.

5. **Hold piece:** Allow hold/swap like modern Tetris? Could add strategic depth.

6. **Garbage interaction:** Should clears send garbage to opponent, or is the overwrite mechanic sufficient pressure?

7. **Sound/haptics:** Distinct audio cue when opponent overwrites your cells.

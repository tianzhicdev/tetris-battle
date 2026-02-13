# Tetris Battle - Game Terminology

Official terminology guide for Tetris Battle components and features.

## 🎮 Board & Grid

| Term | Definition |
|------|------------|
| **Board** | The entire 10x20 playing area for one player |
| **Grid** | The 2D array of cells that make up the board |
| **Cell** | A single square in the grid (can be empty or filled) |
| **Locked Block** | A colored cell that's permanently placed on the board |

## 🧩 Playing Pieces

| Term | Definition |
|------|------------|
| **Tetromino** | The falling shape (official Tetris term) |
| **Current Piece** / **Active Piece** | The piece currently being controlled |
| **Next Piece** | The upcoming piece shown in preview |
| **Ghost Piece** | The transparent preview showing where piece will land |

## 📺 Game Screens

| Term | Definition |
|------|------------|
| **Main Menu** | Initial screen with Solo/Multiplayer choice |
| **Matchmaking Screen** | Waiting room while finding opponent |
| **Battle Screen** | The active gameplay view during multiplayer |
| **Game Over Screen** | End game result display |

## ⭐ Gameplay Elements

| Term | Definition |
|------|------------|
| **Stars** (⭐) | Currency earned from clearing lines |
| **Abilities** / **Powers** | Special moves you can activate |
| **Ability Carousel** | The rotating selection of 3 available abilities |
| **Cooldown** | Time before you can use same ability again |

## 📊 Line Clearing & Rewards

| Clear Type | Lines Cleared | Stars Earned |
|------------|---------------|--------------|
| **Single** | 1 line | 5 ⭐ |
| **Double** | 2 lines | 12 ⭐ |
| **Triple** | 3 lines | 25 ⭐ |
| **Tetris** | 4 lines | 50 ⭐ |
| **Combo** | Multiple clears in succession | +1 ⭐ per combo |

### Star Limits
- **Starting Stars**: 20 ⭐
- **Max Capacity**: 500 ⭐
- **Combo Window**: 3 seconds

## 🎯 Ability Types

### Buffs (Self-Enhancement)
Positive abilities that help you. Displayed with purple/green buttons.

### Debuffs / Attacks (Opponent Disruption)
Negative abilities sent to opponent. Displayed with red buttons.

## 💫 Specific Abilities

### Buffs (8)
1. **Cross FireBomb** (45⭐) - Piece becomes bomb. Clears 3 rows and 3 columns in cross pattern
2. **Circle Bomb** (50⭐) - Piece becomes bomb. Clears all blocks within radius of 3 cells
3. **Clear 5 Rows** (60⭐) - Instantly clear 5 rows from the bottom
4. **Cascade Multiplier** (90⭐) - Double all stars earned for 20 seconds
5. **Piece Preview+** (30⭐) - See next 5 pieces instead of 1 for 15s
6. **Mini Blocks** (40⭐) - Next 5 pieces are simple 2-cell dominoes
7. **Row Eraser** (70⭐) - Delete any single row, even if incomplete
8. **Time Freeze** (55⭐) - Board pauses for 4 seconds to plan freely

### Debuffs / Attacks (12)
9. **Speed Up** (35⭐) - Opponent's pieces fall 3x faster for 15s
10. **Weird Shapes** (80⭐) - Opponent's next 3 pieces are big 5×5 random shapes
11. **Random Spawner** (50⭐) - Random garbage blocks appear every 2 seconds for 20s
12. **Rotation Lock** (60⭐) - Opponent cannot rotate pieces for 20s
13. **Blind Spot** (85⭐) - Bottom 4 rows become invisible for 20s
14. **Reverse Controls** (35⭐) - Opponent's left/right inputs are swapped for 12s
15. **Earthquake** (65⭐) - Every row randomly shifts 1-2 cells, creating gaps
16. **Column Bomb** (45⭐) - Drop 8 garbage blocks into a random column
17. **Screen Shake** (25⭐) - Opponent's board vibrates violently for 10s
18. **Color Scramble** (40⭐) - All blocks randomize colors for 15s
19. **Shrink Ceiling** (50⭐) - Playable area shortened by 4 rows from top for 15s
20. **Mirror Blocks** (55⭐) - Opponent's pieces are mirrored (flipped horizontally) for 15s

### Defense (1)
21. **Deflect Shield** (50⭐) - Blocks next incoming debuff. Stays active until triggered

### Ultra / Legendary (4)
22. **Board Swap** (150⭐) - You and opponent literally trade boards
23. **Piece Thief** (100⭐) - Steal opponent's current piece, give them yours
24. **Gravity Invert** (120⭐) - Opponent's board flips upside down for 10s
25. **Mirror Match** (110⭐) - Every piece you place also drops on opponent's board for 15s

## 🖥️ UI Components

| Component | Description |
|-----------|-------------|
| **Player Board** / **Your Board** | Main playing field (left side, 250x500px) |
| **Opponent Board** / **Enemy Board** | Opponent's field (right side, 100x200px, smaller) |
| **Stats Panel** | Shows Score, Stars, Lines |
| **Ability Panel** | Shows 3 available abilities with costs and cooldowns |
| **Controls Panel** | Keyboard controls reference |
| **Active Effects Display** | Shows currently active abilities with timers |

## 🎮 Game States

| State | Description |
|-------|-------------|
| **Waiting** | In matchmaking queue |
| **Playing** / **Active** | Game in progress |
| **Paused** | Game paused (P key) |
| **Game Over** | One player lost |
| **Finished** | Match completed with winner declared |

## ⌨️ Controls

### Keyboard
- **← →** - Move piece left/right
- **↑** - Rotate piece clockwise
- **↓** - Soft drop (move down faster)
- **SPACE** - Hard drop (instant drop)
- **P** - Pause game
- **1, 2, 3** - Activate abilities

### Mobile (On-Screen Buttons)
- Touch buttons for all controls
- Tap ability buttons to activate

## 🎨 Visual Themes

| Theme | Description |
|-------|-------------|
| **Classic** | Traditional Tetris colors with solid blocks |
| **Retro Pixel Art** | Old-school arcade aesthetic with pixelated blocks |

Users can switch themes via theme selector buttons.

## 🔧 Technical Terms

| Term | Definition |
|------|------------|
| **COST_FACTOR** | Multiplier for all ability costs (default: 1 = 100%) |
| **Tick Rate** | How fast pieces fall (1000ms base, modified by speed effects) |
| **Effect Manager** | System that tracks active ability effects and durations |
| **Game Sync** | Real-time synchronization between players via Partykit |

---

*Last updated: 2026-02-12*

# Tetris PvP — Ability List

> ⭐ = Star cost to activate | All durations and cooldowns are tunable

---

## 🟢 Buffs (Self-Help) — 6 Abilities

| # | Name | Cost | Effect | Duration | Cooldown |
|---|------|------|--------|----------|----------|
| 1 | **Cross FireBomb** | 45 ⭐ | Current piece becomes a bomb. Where it lands and when it lands, it clears 3 rows and 3 columns in a cross pattern. | Instant | 15s |
| 2 | **Circle Bomb** | 50 ⭐ | Current piece becomes a bomb. Where it lands, it clears all blocks within a circular radius of 3 cells. | Instant | 15s |
| 3 | **Clear 5 Rows** | 60 ⭐ | Instantly clear 5 rows from the bottom of your board. | Instant | 15s |
| 4 | **Cascade Multiplier** | 90 ⭐ | Double all stars earned. | 20s | 25s |
| 5 | **Piece Preview+** | 30 ⭐ | See the next 5 upcoming pieces instead of the default preview. | 15s | 20s |
| 6 | **Mini Blocks** | 40 ⭐ | Your next 5 pieces are simple 2-cell dominoes — easy to place anywhere. | 5 pieces | 20s |

---

## 🔴 Debuffs / Attacks (Opponent Disruption) — 12 Abilities

| # | Name | Cost | Effect | Duration | Cooldown |
|---|------|------|--------|----------|----------|
| 7 | **Speed Up** | 35 ⭐ | Opponent's pieces fall 3x faster. | 15s | 20s |
| 8 | **Weird Shapes** | 80 ⭐ | Opponent's next 3 pieces are big, ugly 5×5 random shapes. | 3 pieces | 25s |
| 9 | **Random Spawner** | 50 ⭐ | Random garbage blocks appear on opponent's board every 2 seconds. | 20s | 20s |
| 10 | **Rotation Lock** | 60 ⭐ | Opponent cannot rotate pieces. | 20s | 20s |
| 11 | **Blind Spot** | 85 ⭐ | Bottom 4 rows of opponent's board become invisible. | 20s | 25s |
| 12 | **Reverse Controls** | 35 ⭐ | Opponent's left/right inputs are swapped. | 12s | 15s |
| 13 | **Earthquake** | 65 ⭐ | Every row on opponent's board randomly shifts 1–2 cells left or right, creating jagged gaps. | Instant | 20s |
| 14 | **Column Bomb** | 45 ⭐ | Drop 8 garbage blocks into a random column on opponent's board. | Instant | 15s |
| 15 | **Screen Shake** | 25 ⭐ | Opponent's board vibrates violently. Pure visual chaos. | 10s | 15s |
| 16 | **Color Scramble** | 40 ⭐ | All blocks on opponent's board randomize colors, making gaps hard to read. | 15s | 20s |
| 17 | **Shrink Ceiling** | 50 ⭐ | Opponent's playable area is shortened by 4 rows from the top. | 15s | 20s |
| 18 | **Mirror Blocks** | 55 ⭐ | Opponent's incoming pieces are mirrored (flipped horizontally). | 15s | 20s |

---

## 🟡 Defense — 1 Ability

| # | Name | Cost | Effect | Duration | Cooldown |
|---|------|------|--------|----------|----------|
| 19 | **Deflect Shield** | 50 ⭐ | Blocks the next incoming debuff completely. Stays active until triggered. | Until triggered | 30s |

---

## 🟣 Ultra / Legendary — 4 Abilities

| # | Name | Cost | Effect | Duration | Cooldown |
|---|------|------|--------|----------|----------|
| 20 | **Board Swap** | 150 ⭐ | You and your opponent literally trade boards. | Instant | 60s |
| 21 | **Piece Thief** | 100 ⭐ | Steal opponent's current piece, give them yours. | Instant | 30s |
| 22 | **Gravity Invert** | 120 ⭐ | Opponent's board flips upside down. All their carefully built structures are now on top, gaps on bottom. | 10s | 45s |
| 23 | **Mirror Match** | 110 ⭐ | Every piece you place also drops on opponent's board in the mirrored position. | 15s | 45s |

---

## Summary

| Category | Count | Cost Range |
|----------|-------|------------|
| 🟢 Buffs | 6 | 30–90 ⭐ |
| 🔴 Debuffs | 12 | 25–85 ⭐ |
| 🟡 Defense | 1 | 50 ⭐ |
| 🟣 Ultra | 4 | 100–150 ⭐ |
| **Total** | **23** | **25–150 ⭐** |

---

## Design Notes

- **Star earning**: Players earn ⭐ by clearing lines, combos, and T-spins. Cascade Multiplier doubles this rate temporarily.
- **Ability slots**: Consider limiting players to 4–6 equipped abilities per match (from the full list of 25), creating build diversity and pre-match strategy.
- **Unlock progression**: Players could start with a small pool and unlock more through play, keeping new players from being overwhelmed.
- **Counter-play**: Deflect Shield creates a poker-like mind game — do you attack now or wait to see if they have a shield up?
- **Stacking prevention**: Same debuff shouldn't stack. If Speed Up is already active, a second cast refreshes the timer but doesn't make it 9x.

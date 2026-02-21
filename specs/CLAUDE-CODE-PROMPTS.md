# Cyberpunk Tetris Visual Overhaul — Claude Code Prompts

Paste these into Claude Code **one at a time, in order**. Wait for each to be implemented and working before moving to the next. The reference file is `docs/reference-cyberpunk.jsx` — copy the JSX artifact into your repo at that path first.

---

## PROMPT 0 — Setup

```
Copy the file at docs/reference-cyberpunk.jsx into the repo root as a reference. I'll be referencing specific sections of it in upcoming prompts. Don't integrate it — it's just a visual reference for how I want things to look. Confirm you can read it.
```

---

## PROMPT 1 — HUD: Remove box containers

```
Look at docs/reference-cyberpunk.jsx lines around the "HUD - no boxes, just glowing numbers" comment.

Refactor my game HUD to remove all box/card containers around the score, stars, and lines numbers. The new style should be:

- No background, no border, no box — just the numbers floating
- Each stat has a tiny dim label above it (8px, the stat's color at ~25% opacity, letter-spacing: 4px)
- SCORE is the hero: largest font (28-30px), font-weight 900, colored #00f0f0 with text-shadow: 0 0 20px #00f0f066, 0 0 50px #00f0f022
- STARS and LINES are secondary: 18px, font-weight 700, their own colors (#b040f0 and #f0a020) with softer glows
- COMBO counter only shows when combo > 0, colored #ff2080 with a pulse animation (scale 1.4 → 0.95 → 1 over 0.4s)
- Font family: 'Orbitron' from Google Fonts (import it if not already imported)
- The latency/ping indicator should be shrunk to a tiny dot + number in the corner, 8px font, no border/background

Don't change game logic, just the visual presentation of the HUD.
```

---

## PROMPT 2 — Board: Semi-transparent + vignette + subtle grid

```
Look at docs/reference-cyberpunk.jsx around the board rendering section with comments "Semi-transparent", "Ultra-subtle grid", and "Vignette".

Make these changes to the main game board:

1. Board background: change to rgba(5, 5, 22, 0.78) with backdrop-filter: blur(6px) so background elements bleed through slightly
2. Grid lines: reduce to rgba(255,255,255,0.018) — barely visible, just spatial reference
3. Add a vignette overlay div on top of the board (pointer-events: none, z-index above blocks): background: radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(3,3,15,0.65) 100%)
4. Board border: replace any thick colored border with a subtle 1px solid rgba(0,240,240,0.09) with box-shadow: 0 0 30px rgba(0,240,240,0.03) for a soft glow

Don't change block rendering or game logic, just the board container and its overlays.
```

---

## PROMPT 3 — Block styling: Per-piece gradients + 3D highlights

```
Look at docs/reference-cyberpunk.jsx at how board cells and active pieces are rendered — specifically the gradAngle per piece type and the highlight/shadow divs inside each cell.

Update block/cell rendering:

1. Store a gradient angle per piece type: I=180, O=135, T=150, S=120, Z=160, J=140, L=130. When a piece locks into the board, store both the color AND the gradAngle.
2. Each placed cell renders as: background: linear-gradient(${gradAngle}deg, ${color}dd, ${color}66)
3. Box shadow on each cell: 0 0 6px ${color}44, 0 0 14px ${color}18 (not too bright)
4. Inside each cell div, add two child divs:
   - Top-left highlight: position absolute, top 2px, left 2px, width 40%, height 35%, background rgba(255,255,255,0.18), border-radius: 2px 1px 3px 1px
   - Bottom-right shadow: position absolute, bottom 1px, right 1px, width 50%, height 40%, background rgba(0,0,0,0.12)
5. Active piece uses the same gradient style but at higher opacity (color at ee and 99)
6. Ghost piece: just a 1px border at ${color}30 with background ${color}08, slightly inset (3px padding)
7. border-radius: 3px on all cells

This makes each piece type feel like a different material instead of a texture stamp.
```

---

## PROMPT 4 — Next piece queue: No containers, fading stack

```
Look at docs/reference-cyberpunk.jsx around the "Next queue, no containers" comment.

Refactor the next piece preview:

1. Remove any box/border/background container around the next pieces
2. Show 3 upcoming pieces stacked vertically
3. Each piece fades: first at 85% opacity, second at 45%, third at 20%
4. Each piece scales down: first at scale(1), second at scale(0.85), third at scale(0.7)
5. Use a tiny label above: "NEXT" in 7px, color #ffffff16, letter-spacing 3px
6. The mini blocks in the preview use the same gradient style as the main board (linear-gradient with the piece's gradAngle) at a smaller cell size (12px)
7. Transitions on opacity and transform: 0.3s ease

No containers, no borders — just pieces floating and fading into darkness.
```

---

## PROMPT 5 — Particle system: Core module

```
Look at docs/reference-cyberpunk.jsx at the Particle class definition and the canvas rendering useEffect.

Create a new particle system module with:

1. A Particle class that supports these types:
   - "burst": random direction, gravity (vy += 0.14/frame), square-shaped, for line clears
   - "trail": drifts upward with slight horizontal spread, round, for hard drops
   - "lock": explodes outward from center then decelerates (vx *= 0.95), round, for piece locking
   - "ambient": very slow upward drift, tiny, long-lived, for background atmosphere
   - "lineSweep": slow upward drift, medium-lived, for lingering line clear glow

2. Each particle has: x, y, vx, vy, color, life (0-1), decay rate, size, type

3. A canvas overlay that sits on top of the game board (position absolute, same dimensions, pointer-events none, high z-index)

4. A requestAnimationFrame loop that updates and draws all particles:
   - ctx.shadowColor = particle.color, ctx.shadowBlur = 10 for glow
   - Burst particles draw as fillRect (squares), all others as arc (circles)
   - globalAlpha = particle.life for fade-out

5. An addParticles(x, y, color, count, type) function that other systems can call

6. Ambient particle spawner: every 200ms, if < 120 particles, spawn 1 ambient particle at the bottom of the board in a random cyan-ish hue

Don't wire it to game events yet — just get the system rendering and the ambient particles floating up.
```

---

## PROMPT 6 — Wire particles to game events

```
Now integrate the particle system with game events:

1. LINE CLEAR: For each cell in a cleared row, call addParticles(cellCenterX, cellCenterY, cellColor, 8, "burst") and addParticles(same position, cellColor, 3, "lineSweep")

2. PIECE LOCK: For each cell in the newly locked piece, call addParticles(cellCenterX, cellCenterY, pieceColor, 3, "lock")

3. HARD DROP: For each cell in the piece at its landing position, call addParticles(cellCenterX, cellCenterY, pieceColor, 5, "trail")

Cell center positions are: x = col * CELL_SIZE + CELL_SIZE/2, y = row * CELL_SIZE + CELL_SIZE/2, where CELL_SIZE is whatever your grid cell size is.
```

---

## PROMPT 7 — Screen shake + hard drop trail

```
Look at docs/reference-cyberpunk.jsx at the triggerShake function and the dropTrail state.

Add two effects:

1. SCREEN SHAKE: When lines are cleared, apply a CSS transform to the board container that rapidly randomizes translate(Xpx, Ypx) over ~280ms with quadratic decay. Intensity scales with lines cleared:
   - 1 line: intensity 7
   - 2 lines: intensity 12
   - 3 lines: intensity 17
   - 4 lines (tetris): intensity 22
   - Hard drop (no line clear): intensity 3
   Implementation: use requestAnimationFrame, compute decay as (1-t)², multiply random offset by intensity * decay, set transform via state. Reset to translate(0,0) when done.

2. HARD DROP TRAIL: When a piece is hard-dropped, render translucent ghost cells in a column from the piece's original position to its landing position. Each trail cell:
   - Is the piece's color at ~10% opacity (${color}18)
   - Has box-shadow: 0 0 8px ${color}33
   - Is slightly inset (5px padding on each side)
   - Disappears after 140ms (setTimeout to clear the trail state)
```

---

## PROMPT 8 — Floating score text

```
Look at docs/reference-cyberpunk.jsx at the addFloatingText function and the floating text rendering.

Add floating text popups on game events:

1. When lines are cleared, show a label at the cleared row position:
   - 1 line: "SINGLE" in white
   - 2 lines: "DOUBLE" in cyan (#00f0f0)
   - 3 lines: "TRIPLE" in orange (#f0a020)
   - 4 lines: "TETRIS!" in pink (#ff2080) at a larger font size (24px vs 18px)
   - If combo > 1, append " ×{combo}" to the label

2. Below the label, show "+{points}" in white at 13px

3. Animation: text floats upward (~50px over 1.4s), scales up slightly (1 → 1.15), opacity fades in over the first 15% then fades out over the remaining 85%

4. Implementation: store floating texts as an array of {id, text, x, y, color, size, born: Date.now()}. Render them as absolutely positioned divs. Remove each after 1.4s via setTimeout.

5. Style: font-weight 900, letter-spacing 3px, text-shadow: 0 0 10px ${color}, 0 0 30px ${color}66
```

---

## PROMPT 9 — Skill bar with Chinese characters

```
Look at docs/reference-cyberpunk.jsx around the "Skills bar - Ghost style" comment.

Refactor the power-up/skill buttons:

1. Replace the current colorful bordered buttons with Chinese character icons:
   - Map your skills to characters. Some suggestions: 震(quake), 揺(shake), 墨(ink), 縮(mini), 満(fill), 消(clear). Adjust to match your actual skills.

2. Layout: horizontal row, each skill is 44px wide × 52px tall, no background, no border

3. "Ghost" opacity style:
   - Default: all skills at opacity 0.3
   - Skills the player can't afford: opacity 0.12
   - Active/selected skill: opacity 1.0

4. Each skill button shows:
   - The Chinese character at 24px, font-family 'Noto Sans SC' (import from Google Fonts), color white normally or #00f0f0 when active
   - Active state gets text-shadow: 0 0 16px #00f0f088, 0 0 30px #00f0f044
   - Below the character: ★{cost} in 8px Orbitron, color #ffffff33 (or #00f0f088 when active)

5. Transition: all 0.25s ease on opacity, color, and text-shadow

6. When a skill is activated, show a floating text "−{cost}" in purple (#b040f0) near the skill bar
```

---

## PROMPT 10 — Controls: Ultra-subtle buttons

```
Refactor the movement control buttons at the bottom of the screen:

1. Background: rgba(255,255,255,0.025)
2. Border: 1px solid rgba(255,255,255,0.06)
3. Border-radius: 10px
4. Text color: rgba(255,255,255,0.19)
5. Size: 46px × 44px (hard drop button slightly wider at 56px)
6. Font: system-ui for the arrow symbols
7. Use simple Unicode icons: ◁ (left), ▷ (right), ▽ (soft drop), ▽▽ (hard drop), ↻ (rotate)
8. No colored borders, no glow, no neon — these are utility buttons that should be nearly invisible
9. -webkit-tap-highlight-color: transparent for clean mobile taps

These buttons should be the least visually prominent element on the screen.
```

---

## PROMPT 11 — Line clear flash effect

```
Add a flash effect when rows are cleared:

1. When full rows are detected, DON'T remove them immediately. Instead, mark them as "flashing" for 280ms.

2. During the flash, cells in those rows render with:
   - background: linear-gradient(gradAngle, rgba(255,255,255,0.9), ${cellColor}cc) — they flash white-ish
   - box-shadow: 0 0 16px #ffffff, 0 0 30px ${cellColor}88 — intense glow

3. After 280ms, remove the rows and shift everything down as normal.

4. This creates a visible "flash → dissolve → collapse" sequence that, combined with the particles and screen shake from earlier prompts, makes line clears feel impactful.
```

---

## PROMPT 12 — Lock flash (piece settling glow)

```
Add a subtle glow pulse when a piece locks into the board:

1. When a piece is locked, record which cells it occupied.

2. For 180ms, render a radial gradient overlay on each of those cells:
   - A div positioned over each cell, slightly larger (4px padding on each side)
   - background: radial-gradient(circle, ${pieceColor}44, transparent 70%)
   - CSS animation: scale from 1.15 to 1.0, opacity from 1 to 0, over 180ms ease-out

3. Remove the overlay after 180ms.

This subtle pulse confirms the piece has settled and adds a tiny moment of feedback to every single piece placement.
```

---

## Notes

- If anything breaks, tell Claude Code to revert just that change
- Test on mobile after prompts 9 and 10 — those affect touch controls
- The particle system (prompts 5-6) is the biggest change — test that it doesn't lag on mobile. If it does, reduce max particles from 120 to 60 and reduce burst count from 8 to 4.
- After all 12 prompts, you have the complete cyberpunk reference style. Theming later is just swapping the color/font/particle config.

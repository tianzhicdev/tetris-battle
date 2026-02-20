# Implementation Plan for Cyberpunk Tetris Visual Overhaul

## Overview
- Total steps: 12 (matching the 12 prompts in the spec)
- Estimated new files: 1 (CyberpunkParticles component)
- Estimated modified files: 7

## Implementation Strategy
The spec provides 12 prompts meant to be executed sequentially. We'll follow this order exactly, implementing each prompt as a step. The reference file `docs/reference-cyberpunk.jsx` contains all visual specifications.

## Steps

### Step 1: HUD - Remove box containers

**Files to modify:**
- `packages/web/src/components/game/GameHeader.tsx`

**Implementation details:**
Replace the current compact header layout with floating glowing numbers:

1. Change the main container from horizontal flex to a centered layout
2. Replace the current score/stars display with individual stat groups:
   - Each stat has a tiny label (8px, #00f0f044 for score, #b040f044 for stars, #f0a02044 for lines)
   - Label style: letterSpacing: 4, all caps
   - SCORE: fontSize 30, fontWeight 900, color #00f0f0, textShadow: '0 0 20px #00f0f066, 0 0 50px #00f0f022'
   - STARS: fontSize 18, fontWeight 700, color #b040f0, textShadow: '0 0 12px #b040f044'
   - LINES: fontSize 18, fontWeight 700, color #f0a020, textShadow: '0 0 12px #f0a02044'
3. Add COMBO counter (conditional, only when combo > 0):
   - fontSize 18, fontWeight 900, color #ff2080
   - textShadow: '0 0 20px #ff208088'
   - CSS animation: comboPulse 0.4s ease (scale 1.4 → 0.95 → 1)
4. Add fontFamily: 'Orbitron' to all number elements
5. Shrink the latency indicator to 8px font, minimal styling (just dot + number)

**Changes to GameHeaderProps:**
```typescript
// Add optional combo and linesCleared props
interface GameHeaderProps {
  score: number;
  stars: number;
  linesCleared?: number;  // NEW
  comboCount?: number;    // NEW
  notifications: AbilityNotification[];
  isConnected: boolean;
  connectionStats: ConnectionStats | null;
}
```

**Test:**
- Manual: Run dev server, verify HUD shows floating numbers with glows
- Check: SCORE is largest and most prominent
- Check: COMBO only appears when combo > 0
- Check: All text uses Orbitron font

**Verify:**
- No boxes/containers around stats
- Glowing text effects visible
- Combo counter pulses when active

---

### Step 2: Board - Semi-transparent + vignette + subtle grid

**Files to modify:**
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx` (board rendering section, around line 900-1100)

**Implementation details:**
Update the board container and overlays in the main render return:

1. Find the main board canvas container div (the one wrapping the canvas)
2. Change background to: rgba(5, 5, 22, 0.78)
3. Add backdropFilter: 'blur(6px)'
4. Update border to: '1px solid rgba(0,240,240,0.09)'
5. Update boxShadow to: '0 0 30px rgba(0,240,240,0.03)'

For grid lines (if using canvas grid rendering):
6. In TetrisRenderer or inline canvas drawing, set grid stroke color to rgba(255,255,255,0.018)

Add vignette overlay:
7. Add a new div as a sibling to the canvas, positioned absolutely with same dimensions
8. Style: `position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(3,3,15,0.65) 100%)', pointerEvents: 'none', zIndex: 6`

**Test:**
- Manual: Run dev server, verify board is semi-transparent
- Check: Background elements slightly visible through board
- Check: Vignette darkens edges
- Check: Grid lines barely visible (very subtle)

**Verify:**
- Board has glassmorphism effect (blur + transparency)
- Vignette overlay renders on top
- Grid lines are ultra-subtle

---

### Step 3: Block styling - Per-piece gradients + 3D highlights

**Files to modify:**
- `packages/game-core/src/types.ts` - Add gradAngle to piece definitions
- `packages/game-core/src/constants.ts` or similar - Define PIECE_GRAD_ANGLES
- `packages/web/src/renderer/TetrisRenderer.ts` - Update renderBlock to use gradients
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx` - Pass gradAngle when storing locked pieces

**Implementation details:**

1. In game-core, define gradient angles:
```typescript
// packages/game-core/src/constants.ts (create if doesn't exist)
export const PIECE_GRAD_ANGLES: Record<TetrominoType, number> = {
  I: 180,
  O: 135,
  T: 150,
  S: 120,
  Z: 160,
  J: 140,
  L: 130,
};
```

2. Update board cell storage to include gradAngle:
   - When locking a piece in ServerAuthMultiplayerGame, store `{ color: pieceColor, gradAngle: PIECE_GRAD_ANGLES[pieceType] }`
   - Board cells become `{ color: string, gradAngle: number } | null`

3. Update TetrisRenderer.drawBoard:
   - For each cell, extract color and gradAngle
   - Draw cell background as linear gradient: `ctx.createLinearGradient(...)` using gradAngle
   - Gradient stops: `${color}dd` at 0%, `${color}66` at 100%
   - Add box-shadow effect (can simulate with extra rectangles or use canvas glow)

4. Add 3D highlight/shadow divs (if rendering cells as DOM instead of canvas):
   - Each cell div contains two child divs:
   - Top-left highlight: `position: 'absolute', top: 2, left: 2, width: '40%', height: '35%', background: 'rgba(255,255,255,0.18)', borderRadius: '2px 1px 3px 1px'`
   - Bottom-right shadow: `position: 'absolute', bottom: 1, right: 1, width: '50%', height: '40%', background: 'rgba(0,0,0,0.12)'`

5. Update active piece rendering to use gradAngle with higher opacity (ee, 99)

6. Update ghost piece: 1px border at ${color}30, background ${color}08, inset padding 3px

7. Set borderRadius: 3px on all cells

**Test:**
- Manual: Run dev server, drop pieces and verify gradient renders
- Check: Each piece type has a unique gradient angle
- Check: Locked pieces maintain gradient
- Check: 3D highlights visible on blocks

**Verify:**
- Gradients render correctly for all 7 piece types
- Active piece brighter than locked pieces
- Ghost piece subtle and inset
- 3D depth effect visible

---

### Step 4: Next piece queue - No containers, fading stack

**Files to modify:**
- `packages/web/src/components/game/NextPieceQueue.tsx`

**Implementation details:**

1. Remove the outer container background/border styles (lines ~33-44)
2. Change layout to pure vertical stack with no container
3. Add tiny "NEXT" label above pieces:
   - fontSize: 7, color: '#ffffff16', letterSpacing: 3, marginBottom: 4
4. For each piece in queue (show 3):
   - Apply opacity: [0.85, 0.45, 0.2][index]
   - Apply transform: `scale(${[1, 0.85, 0.7][index]})`
   - Add transition: 'all 0.3s ease'
5. Render mini blocks (12px cell size) with same gradient style as main board:
   - Use PIECE_GRAD_ANGLES imported from game-core
   - linear-gradient with piece's gradAngle
   - No background container, just floating gradient cells

**Test:**
- Manual: Run dev server, verify next pieces fade and scale
- Check: First piece full opacity, second dimmed, third very dim
- Check: Pieces scale down progressively
- Check: Mini blocks use gradient rendering

**Verify:**
- No containers/boxes around next pieces
- Fading opacity progression
- Scaling progression
- Smooth transitions

---

### Step 5: Particle system - Core module

**Files to create:**
- `packages/web/src/components/CyberpunkParticles.tsx`

**Implementation details:**

Create a new component with:

1. Particle class definition:
```typescript
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  decay: number;
  size: number;
  type: 'burst' | 'trail' | 'lock' | 'ambient' | 'lineSweep';

  constructor(x: number, y: number, color: string, type: 'burst' | 'trail' | 'lock' | 'ambient' | 'lineSweep') {
    this.x = x;
    this.y = y;
    this.color = color;
    this.type = type;

    if (type === 'burst') {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 5;
      this.vx = Math.cos(a) * sp;
      this.vy = Math.sin(a) * sp - 2;
      this.life = 1;
      this.decay = 0.014 + Math.random() * 0.02;
      this.size = 2 + Math.random() * 4;
    }
    // ... similar for other types (reference reference-cyberpunk.jsx lines 59-79)
  }

  update(): boolean {
    this.x += this.vx;
    this.y += this.vy;
    if (this.type === 'burst') this.vy += 0.14; // gravity
    if (this.type === 'lock') { this.vx *= 0.95; this.vy *= 0.95; }
    this.life -= this.decay;
    return this.life > 0;
  }
}
```

2. Component structure:
```typescript
interface CyberpunkParticlesProps {
  width: number;
  height: number;
}

export interface CyberpunkParticlesHandle {
  addParticles(x: number, y: number, color: string, count: number, type: ParticleType): void;
}

export const CyberpunkParticles = forwardRef<CyberpunkParticlesHandle, CyberpunkParticlesProps>(
  ({ width, height }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const frameRef = useRef<number | null>(null);

    // addParticles function
    const addParticles = useCallback((x, y, color, count, type) => {
      for (let i = 0; i < count; i++) {
        particlesRef.current.push(new Particle(x, y, color, type));
      }
    }, []);

    // Expose via ref
    useImperativeHandle(ref, () => ({ addParticles }), [addParticles]);

    // Ambient particle spawner (every 200ms, max 120 particles)
    useEffect(() => {
      const interval = setInterval(() => {
        if (particlesRef.current.length < 120) {
          const hue = 180 + Math.random() * 40;
          addParticles(Math.random() * width, height + 5, `hsl(${hue}, 60%, 50%)`, 1, 'ambient');
        }
      }, 200);
      return () => clearInterval(interval);
    }, [width, height, addParticles]);

    // requestAnimationFrame loop
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      let running = true;

      const draw = () => {
        if (!running) return;
        ctx.clearRect(0, 0, width, height);

        particlesRef.current = particlesRef.current.filter((p) => {
          const alive = p.update();
          if (!alive) return false;

          ctx.globalAlpha = Math.min(p.life, 1) * (p.type === 'ambient' ? 0.6 : 1);
          ctx.shadowColor = p.color;
          ctx.shadowBlur = p.type === 'ambient' ? 3 : p.type === 'lineSweep' ? 8 : 10;
          ctx.fillStyle = p.color;

          if (p.type === 'burst') {
            const s = p.size * Math.max(p.life, 0.2);
            ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
          } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * Math.min(p.life + 0.3, 1), 0, Math.PI * 2);
            ctx.fill();
          }

          return true;
        });

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        frameRef.current = requestAnimationFrame(draw);
      };

      draw();
      return () => {
        running = false;
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
      };
    }, [width, height]);

    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 8,
          pointerEvents: 'none',
        }}
      />
    );
  }
);
```

**Test:**
- Manual: Import CyberpunkParticles into a test page, call addParticles manually
- Check: Ambient particles spawn and float upward
- Check: Canvas renders without errors
- Check: Particle types render correctly (squares for burst, circles for others)

**Verify:**
- Particle canvas renders on top of game board
- Ambient particles continuously spawn
- requestAnimationFrame loop runs smoothly

---

### Step 6: Wire particles to game events

**Files to modify:**
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx`

**Implementation details:**

1. Import CyberpunkParticles component
2. Add ref: `const particlesRef = useRef<CyberpunkParticlesHandle>(null);`
3. Render CyberpunkParticles in the board container (after canvas, before vignette)
4. Wire up events:

**LINE CLEAR** detection (in state update useEffect where linesCleared increases):
```typescript
if (newLinesCleared > yourState.linesCleared) {
  // Detect which rows were cleared by comparing previous and current board
  const clearedRows = detectClearedRows(prevBoard, currentBoard);
  clearedRows.forEach(rowIndex => {
    for (let col = 0; col < boardWidth; col++) {
      const cellColor = prevBoard[rowIndex][col]?.color || '#00d4ff';
      particlesRef.current?.addParticles(
        col * CELL_SIZE + CELL_SIZE / 2,
        rowIndex * CELL_SIZE + CELL_SIZE / 2,
        cellColor,
        8,
        'burst'
      );
      particlesRef.current?.addParticles(
        col * CELL_SIZE + CELL_SIZE / 2,
        rowIndex * CELL_SIZE + CELL_SIZE / 2,
        cellColor,
        3,
        'lineSweep'
      );
    }
  });
}
```

**PIECE LOCK** detection (when currentPiece changes to null after having a value):
```typescript
if (prevCurrentPiece && !yourState.currentPiece) {
  // Piece locked - spawn particles at each cell
  const cells = getPieceCells(prevCurrentPiece);
  cells.forEach(({ x, y, color }) => {
    particlesRef.current?.addParticles(
      x * CELL_SIZE + CELL_SIZE / 2,
      y * CELL_SIZE + CELL_SIZE / 2,
      color,
      3,
      'lock'
    );
  });
}
```

**HARD DROP** (detect via input or score jump):
```typescript
// When hard drop occurs (detected by specific input or score change pattern)
const landingCells = getHardDropCells(yourState.currentPiece);
landingCells.forEach(({ x, y, color }) => {
  particlesRef.current?.addParticles(
    x * CELL_SIZE + CELL_SIZE / 2,
    y * CELL_SIZE + CELL_SIZE / 2,
    color,
    5,
    'trail'
  );
});
```

**Test:**
- Manual: Run game, clear a line and verify burst + lineSweep particles spawn
- Manual: Drop a piece and verify lock particles spawn
- Manual: Hard drop and verify trail particles spawn
- Check: Particle positions match cell centers
- Check: Particle colors match cell colors

**Verify:**
- Line clears trigger 8 burst + 3 lineSweep particles per cell
- Piece locks trigger 3 lock particles per cell
- Hard drops trigger 5 trail particles per cell
- Particles render at correct positions

---

### Step 7: Screen shake + hard drop trail

**Files to modify:**
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx`

**Implementation details:**

1. Add state: `const [shake, setShake] = useState({ x: 0, y: 0 });`

2. Create triggerShake function:
```typescript
const triggerShake = useCallback((intensity: number) => {
  const dur = 280;
  const start = Date.now();

  const anim = () => {
    const t = (Date.now() - start) / dur;
    if (t > 1) {
      setShake({ x: 0, y: 0 });
      return;
    }
    const decay = (1 - t) * (1 - t); // quadratic
    setShake({
      x: (Math.random() - 0.5) * intensity * decay * 2,
      y: (Math.random() - 0.5) * intensity * decay * 2,
    });
    requestAnimationFrame(anim);
  };

  anim();
}, []);
```

3. Apply shake transform to board container:
   - Find the div wrapping the canvas
   - Add: `transform: `translate(${shake.x}px, ${shake.y}px)``

4. Call triggerShake on events:
   - 1 line: intensity 7
   - 2 lines: intensity 12
   - 3 lines: intensity 17
   - 4 lines (tetris): intensity 22
   - Hard drop (no line clear): intensity 3

5. Add hard drop trail state:
```typescript
const [dropTrail, setDropTrail] = useState<Array<{ x: number; y: number; color: string }>>([]);
```

6. On hard drop, calculate trail cells from original Y to landing Y:
```typescript
// When hard drop detected
const trailCells: Array<{ x: number, y: number, color: string }> = [];
for (let r = 0; r < piece.shape.length; r++) {
  for (let c = 0; c < piece.shape[0].length; c++) {
    if (piece.shape[r][c]) {
      for (let ty = originalY + r; ty <= landingY + r; ty++) {
        trailCells.push({ x: piece.x + c, y: ty, color: piece.color });
      }
    }
  }
}
setDropTrail(trailCells);
setTimeout(() => setDropTrail([]), 140);
```

7. Render trail cells as divs (positioned absolutely):
```typescript
{dropTrail.map((t, i) => (
  <div key={`tr-${i}`} style={{
    position: 'absolute',
    left: t.x * CELL_SIZE + 5,
    top: t.y * CELL_SIZE + 5,
    width: CELL_SIZE - 10,
    height: CELL_SIZE - 10,
    borderRadius: 2,
    background: `${t.color}18`,
    boxShadow: `0 0 8px ${t.color}33`,
    zIndex: 1,
  }} />
))}
```

**Test:**
- Manual: Clear lines and verify board shakes
- Manual: Clear tetris and verify strong shake
- Manual: Hard drop and verify trail renders for 140ms
- Check: Shake intensity scales with lines cleared
- Check: Trail cells span from start to landing position

**Verify:**
- Screen shake triggers on line clear and hard drop
- Shake intensity proportional to lines cleared
- Hard drop trail renders and disappears after 140ms
- Shake uses quadratic decay

---

### Step 8: Floating score text

**Files to modify:**
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx`

**Implementation details:**

1. Add state:
```typescript
type FloatingText = {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  born: number;
};
const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
```

2. Create addFloatingText function:
```typescript
const addFloatingText = useCallback((text: string, x: number, y: number, color: string, size: number) => {
  const id = Date.now() + Math.random();
  setFloatingTexts(prev => [...prev, { id, text, x, y, color, size, born: Date.now() }]);
  setTimeout(() => {
    setFloatingTexts(prev => prev.filter(t => t.id !== id));
  }, 1400);
}, []);
```

3. On line clear, add floating text:
```typescript
const labels = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS!'];
const colors = ['', '#ffffff', '#00f0f0', '#f0a020', '#ff2080'];
const linesClearedThisFrame = newLinesCleared - prevLinesCleared;

if (linesClearedThisFrame > 0) {
  const label = labels[linesClearedThisFrame] + (comboCount > 1 ? ` ×${comboCount}` : '');
  const size = linesClearedThisFrame === 4 ? 24 : 18;

  addFloatingText(
    label,
    boardWidth * CELL_SIZE / 2,
    clearedRow * CELL_SIZE - 10,
    colors[linesClearedThisFrame],
    size
  );

  addFloatingText(
    `+${scoreEarned}`,
    boardWidth * CELL_SIZE / 2,
    clearedRow * CELL_SIZE + 18,
    '#ffffffcc',
    13
  );
}
```

4. Render floating texts:
```typescript
{floatingTexts.map(ft => {
  const age = Math.min((Date.now() - ft.born) / 1400, 1);
  return (
    <div key={ft.id} style={{
      position: 'absolute',
      left: ft.x,
      top: ft.y - age * 50, // float up
      transform: `translateX(-50%) scale(${1 + age * 0.15})`, // scale up
      fontSize: ft.size,
      fontWeight: 900,
      color: ft.color,
      textShadow: `0 0 10px ${ft.color}, 0 0 30px ${ft.color}66`,
      opacity: age < 0.15 ? age / 0.15 : 1 - (age - 0.15) / 0.85, // fade in 15%, fade out 85%
      zIndex: 20,
      pointerEvents: 'none',
      letterSpacing: 3,
      whiteSpace: 'nowrap',
      fontFamily: 'Orbitron',
    }}>
      {ft.text}
    </div>
  );
})}
```

**Test:**
- Manual: Clear 1 line and verify "SINGLE" appears in white
- Manual: Clear 2 lines and verify "DOUBLE" appears in cyan
- Manual: Clear 4 lines and verify "TETRIS!" appears in pink at larger size
- Manual: Clear with combo and verify "×N" appended
- Check: Score "+X" appears below line clear text
- Check: Text floats up and fades out over 1.4 seconds

**Verify:**
- Floating text appears on line clears
- Text color matches line count
- TETRIS! is larger than other labels
- Combo multiplier shown when combo > 1
- Score value shown below label
- Animation smooth (float up, scale, fade)

---

### Step 9: Skill bar with Chinese characters

**Files to modify:**
- `packages/web/src/components/game/AbilityDock.tsx`

**Implementation details:**

1. Define Chinese character mapping (at top of file):
```typescript
const ABILITY_CHARS: Record<string, string> = {
  earthquake: '震',
  screen_shake: '揺',
  blind_spot: '墨',
  ink_splash: '墨',
  mini_blocks: '縮',
  fill_holes: '満',
  clear_rows: '消',
  speed_up_opponent: '速',
  reverse_controls: '逆',
  rotation_lock: '鎖',
  shrink_ceiling: '縮',
  random_spawner: '乱',
  gold_digger: '金',
  deflect_shield: '盾',
  cascade_multiplier: '倍',
  piece_preview_plus: '視',
  cross_firebomb: '爆',
  circle_bomb: '円',
  death_cross: '十',
  row_rotate: '回',
  weird_shapes: '奇',
};
```

2. Replace button content with Chinese character:
```typescript
<motion.button
  key={ability.id}
  whileTap={affordable ? 'tap' : undefined}
  variants={buttonVariants}
  transition={springs.snappy}
  onClick={() => { if (affordable) onActivate(ability); }}
  disabled={!affordable}
  title={`${ability.name}: ${ability.description}`}
  style={{
    width: 44,
    height: 52,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: affordable ? 'pointer' : 'default',
    opacity: isActive ? 1 : affordable ? 0.3 : 0.12, // ghost opacity
    transition: 'all 0.25s ease',
    border: 'none',
    background: 'transparent',
  }}
>
  <div style={{
    fontSize: 24,
    color: isActive ? '#00f0f0' : '#ffffff',
    fontFamily: "'Noto Sans SC', sans-serif",
    lineHeight: 1,
    textShadow: isActive ? '0 0 16px #00f0f088, 0 0 30px #00f0f044' : 'none',
    transition: 'all 0.25s',
  }}>
    {ABILITY_CHARS[ability.type] || '✨'}
  </div>
  <div style={{
    fontSize: 8,
    color: isActive ? '#00f0f088' : '#ffffff33',
    marginTop: 3,
    fontFamily: "'Orbitron'",
    letterSpacing: 1,
  }}>
    ★{ability.cost}
  </div>
</motion.button>
```

3. On ability activation, add floating text near skill bar:
```typescript
// When ability activated
addFloatingText(`−${ability.cost}`, boardWidth * CELL_SIZE / 2, boardHeight * CELL_SIZE - 20, '#b040f0', 12);
```

**Test:**
- Manual: Run game and verify abilities show Chinese characters
- Manual: Verify unaffordable abilities at 0.12 opacity
- Manual: Verify affordable abilities at 0.3 opacity
- Manual: Activate ability and verify it goes to 1.0 opacity with glow
- Manual: Verify floating "−cost" text appears on activation
- Check: Noto Sans SC font renders correctly
- Check: Ghost opacity progression works

**Verify:**
- All 20 abilities have Chinese characters mapped
- Opacity states: 0.12 (unaffordable), 0.3 (affordable), 1.0 (active)
- Active abilities have cyan glow
- Cost displayed in Orbitron font
- Floating cost deduction text on activation

---

### Step 10: Controls - Ultra-subtle buttons

**Files to modify:**
- `packages/web/src/components/game/GameTouchControls.tsx`

**Implementation details:**

1. Update baseButton style (line ~13):
```typescript
const baseButton: CSSProperties = {
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '10px',
  color: 'rgba(255,255,255,0.19)',
  width: 46,  // hard drop will override to 56
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'manipulation',
  fontFamily: 'system-ui',
  fontSize: 14,
  WebkitTapHighlightColor: 'transparent',
};
```

2. Replace button labels with Unicode symbols:
```typescript
<motion.button ... style={{ ...baseButton }}>◁</motion.button>  // left
<motion.button ... style={{ ...baseButton, width: 56 }}>▽▽</motion.button>  // hard drop (wider)
<motion.button ... style={{ ...baseButton }}>▽</motion.button>  // soft drop
<motion.button ... style={{ ...baseButton, fontSize: 18 }}>↻</motion.button>  // rotate (larger)
<motion.button ... style={{ ...baseButton }}>▷</motion.button>  // right
```

3. Remove any colored borders/glows from hard drop button
4. Ensure all buttons have minimal visibility (ultra-subtle)

**Test:**
- Manual: Run game on mobile/desktop and verify control buttons
- Check: Buttons barely visible against background
- Check: Unicode arrows render correctly
- Check: Hard drop button is slightly wider
- Check: Rotate button icon slightly larger
- Check: No tap highlight on mobile

**Verify:**
- All buttons use minimal styling
- Unicode icons render correctly
- Hard drop button width 56px, others 46px
- No colored borders or glows
- WebKit tap highlight disabled

---

### Step 11: Line clear flash effect

**Files to modify:**
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx`

**Implementation details:**

1. Add state to track flashing rows:
```typescript
const [flashingRows, setFlashingRows] = useState<number[]>([]);
```

2. On line clear detection, instead of immediately clearing:
```typescript
// When rows detected as full
const fullRowIndices = [/* ... */];
setFlashingRows(fullRowIndices);

setTimeout(() => {
  // After 280ms, actually remove rows and shift down
  const newBoard = removeRowsAndShift(board, fullRowIndices);
  setBoard(newBoard);
  setFlashingRows([]);
}, 280);
```

3. Update cell rendering to check if row is flashing:
```typescript
// When rendering board cells
const isFlashing = flashingRows.includes(rowIndex);

if (isFlashing) {
  // Flash style
  background = `linear-gradient(${gradAngle}deg, rgba(255,255,255,0.9), ${color}cc)`;
  boxShadow = `0 0 16px #ffffff, 0 0 30px ${color}88`;
} else {
  // Normal style
  background = `linear-gradient(${gradAngle}deg, ${color}dd, ${color}66)`;
  boxShadow = `0 0 6px ${color}44, 0 0 14px ${color}18`;
}
```

4. Add CSS transition for smooth flash:
```typescript
transition: isFlashing ? 'all 0.08s' : 'none'
```

**Test:**
- Manual: Clear a line and verify it flashes white before disappearing
- Manual: Clear multiple lines and verify all flash simultaneously
- Manual: Check timing is 280ms before rows disappear
- Check: Flash combined with particles creates satisfying effect

**Verify:**
- Rows flash white before clearing
- Flash duration exactly 280ms
- Multiple rows flash together
- Flash transitions smoothly
- Rows disappear after flash completes

---

### Step 12: Lock flash (piece settling glow)

**Files to modify:**
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx`

**Implementation details:**

1. Add state for lock flash:
```typescript
type LockFlash = {
  cells: Array<{ x: number; y: number }>;
  color: string;
  time: number;
};
const [lockFlash, setLockFlash] = useState<LockFlash | null>(null);
```

2. On piece lock (when currentPiece becomes null):
```typescript
// When piece locks
const lockedCells = getPieceCells(prevCurrentPiece);
setLockFlash({
  cells: lockedCells.map(c => ({ x: c.x, y: c.y })),
  color: prevCurrentPiece.color,
  time: Date.now(),
});

setTimeout(() => setLockFlash(null), 180);
```

3. Render lock flash overlays:
```typescript
{lockFlash && lockFlash.cells.map((c, i) => (
  <div key={`lf-${i}`} style={{
    position: 'absolute',
    left: c.x * CELL_SIZE - 4,
    top: c.y * CELL_SIZE - 4,
    width: CELL_SIZE + 8,
    height: CELL_SIZE + 8,
    background: `radial-gradient(circle, ${lockFlash.color}44, transparent 70%)`,
    zIndex: 3,
    pointerEvents: 'none',
    animation: 'lockPulse 0.18s ease-out',
  }} />
))}
```

4. Add CSS animation (in a style tag or inline keyframes):
```css
@keyframes lockPulse {
  0% { opacity: 1; transform: scale(1.15); }
  100% { opacity: 0; transform: scale(1); }
}
```

**Test:**
- Manual: Drop a piece and verify subtle glow pulse on lock
- Manual: Verify glow disappears after 180ms
- Check: Glow scales from 1.15 to 1.0
- Check: Glow fades out simultaneously
- Check: Multiple cells pulse together

**Verify:**
- Lock flash renders on every piece lock
- Animation duration 180ms
- Scale and fade animation smooth
- Radial gradient creates soft glow
- Flash positioned correctly over locked cells

---

## Verification Mapping

| Spec Prompt | Implemented by Step(s) | Verification Method |
|-------------|------------------------|---------------------|
| PROMPT 1: HUD no boxes | Step 1 | Manual: Check floating glowing numbers |
| PROMPT 2: Board semi-transparent | Step 2 | Manual: Check glassmorphism effect |
| PROMPT 3: Block gradients | Step 3 | Manual: Check 7 unique gradients |
| PROMPT 4: Next queue fading | Step 4 | Manual: Check opacity/scale progression |
| PROMPT 5: Particle core | Step 5 | Manual: Check ambient particles |
| PROMPT 6: Particle wiring | Step 6 | Manual: Clear lines, drop pieces |
| PROMPT 7: Shake + trail | Step 7 | Manual: Clear lines, hard drop |
| PROMPT 8: Floating text | Step 8 | Manual: Clear lines with combo |
| PROMPT 9: Chinese skills | Step 9 | Manual: Check character rendering |
| PROMPT 10: Subtle controls | Step 10 | Manual: Check ultra-minimal buttons |
| PROMPT 11: Flash effect | Step 11 | Manual: Clear lines and watch flash |
| PROMPT 12: Lock flash | Step 12 | Manual: Drop pieces and watch pulse |

## Build/Test Commands
- **Dev server**: `pnpm dev` (run from project root)
- **Build**: `pnpm --filter web build`
- **Type check**: `pnpm --filter web build` (TypeScript compiler will error if types broken)
- **Tests**: `pnpm --filter web test` (run after each step to ensure no regressions)
- **Manual testing**: Open `http://localhost:5173` in browser

## Implementation Notes
- All steps reference `docs/reference-cyberpunk.jsx` for exact visual specifications
- Google Fonts (Orbitron, Noto Sans SC) already imported in index.html
- No external dependencies needed (all canvas/DOM based)
- Steps are sequential but can be tested independently
- Each step maintains playability (game never breaks)

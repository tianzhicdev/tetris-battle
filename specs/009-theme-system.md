# Spec 009: Customizable UI/UX Theme System

## Status
💡 **FEATURE REQUEST** - Multiple visual styles for personalization

## Problem

### Current State
The game has a single visual style (glassy/modern theme):
- Fixed color palette
- Fixed block rendering style
- Fixed typography
- Fixed particle effects
- No user choice or personalization

**Limitations:**
- Players cannot customize visual experience
- Limited appeal to different aesthetic preferences
- Missed opportunity for player expression
- No variety for different moods or contexts
- Hard-coded styling mixed with game logic

### Desired State
A robust theme system supporting at least 10 distinct visual styles:
- Players can choose their preferred theme
- Each theme has unique visuals, typography, effects, and sounds
- Theme can be changed mid-game without breaking state
- Themes are modular and easy to add
- Clear separation between game logic and presentation

## Theme Catalog

### 1. Retro 8-bit
**Aesthetic**: NES/Game Boy era nostalgia
- **Blocks**: Pixel art graphics (8x8 or 16x16 sprites)
- **Typography**: Chunky pixel fonts (Press Start 2P, RetroGaming)
- **Effects**: Scanline overlay, CRT curve, chromatic aberration
- **Colors**: Limited palette (4-16 colors), NES/Game Boy constraints
- **Sounds**: Chiptune bleeps, bloops, and arpeggios
- **Particles**: Pixel explosions with limited colors
- **Board**: Pixel grid with visible borders

**References**: Tetris (NES), Game Boy Tetris

### 2. Neon Cyberpunk
**Aesthetic**: Tron meets vaporwave arcade
- **Blocks**: Glowing neon outlines with bloom/glow effects
- **Typography**: Futuristic sans-serif with glow
- **Effects**: Bloom, chromatic aberration, scan lines, grid distortion
- **Colors**: Hot pink, electric blue, purple, cyan (high saturation)
- **Sounds**: Synthwave bass hits, electronic whooshes
- **Particles**: Light trails, neon sparks, digital glitches
- **Board**: Dark background with glowing grid lines

**References**: Tron, Cyberpunk 2077, Hotline Miami

### 3. Minimalist Flat
**Aesthetic**: Modern, clean, focused
- **Blocks**: Flat geometric shapes, no gradients or shadows
- **Typography**: Thin sans-serif (Inter, Helvetica Neue)
- **Effects**: None or subtle fade transitions
- **Colors**: Monochrome or muted palette (grays, pastels)
- **Sounds**: Soft clicks, minimal feedback
- **Particles**: Simple circles or squares fading out
- **Board**: Lots of whitespace, thin grid lines

**References**: Monument Valley, Material Design (pre-2.0)

### 4. Glassmorphism
**Aesthetic**: Modern iOS premium feel
- **Blocks**: Translucent frosted glass with backdrop blur
- **Typography**: SF Pro Display, rounded modern sans
- **Effects**: Backdrop blur (backdrop-filter), soft shadows
- **Colors**: Colorful gradient background bleeding through blocks
- **Sounds**: Soft satisfying clicks, gentle whooshes
- **Particles**: Blurred bubbles, soft light orbs
- **Board**: Gradient background with blurred overlay

**References**: iOS 15+, macOS Big Sur, Windows 11

### 5. Brutalist
**Aesthetic**: Raw, unpolished, striking
- **Blocks**: Hard edges, visible borders, no anti-aliasing
- **Typography**: Monospaced bold (Courier New, IBM Plex Mono)
- **Effects**: High contrast, no smoothing, sharp edges
- **Colors**: Black, white, one harsh accent (red, yellow)
- **Sounds**: Harsh clicks, industrial sounds
- **Particles**: Geometric shards, angular fragments
- **Board**: Thick grid borders, intentionally "ugly" contrast

**References**: Craigslist, brutalist architecture websites

### 6. Isometric 3D
**Aesthetic**: Faux-3D depth without full rendering
- **Blocks**: Isometric cubes (30° angle projection)
- **Typography**: Clean sans-serif with slight shadow
- **Effects**: Drop shadows, slight depth layering
- **Colors**: Varied palette with shading for depth
- **Sounds**: Spatial audio cues for depth
- **Particles**: 3D-looking debris with perspective
- **Board**: Isometric grid, elevated platform appearance

**References**: Monument Valley, Q*bert, isometric RPGs

### 7. Hand-drawn / Sketch
**Aesthetic**: Notebook doodles come to life
- **Blocks**: Wobbly lines, pencil/marker textures
- **Typography**: Handwritten fonts (Permanent Marker, Indie Flower)
- **Effects**: Paper texture, crosshatch shading, slight wobble animation
- **Colors**: Marker colors on white/lined paper
- **Sounds**: Pencil scratches, paper rustling
- **Particles**: Eraser shavings, pencil shavings
- **Board**: Lined notebook paper or graph paper background

**References**: Doodle Jump, Draw a Stickman

### 8. Nature / Organic
**Aesthetic**: Natural materials and seasons
- **Blocks**: Wooden tiles, stones, leaves, ice crystals (changes with level/season)
- **Typography**: Organic serif or handwritten
- **Effects**: Seasonal transitions, weather particles
- **Colors**: Earthy tones (browns, greens) or icy blues (depending on season)
- **Sounds**: Natural sounds (wood clacks, stone clicks, wind chimes)
- **Particles**: Falling leaves, petals, snowflakes, sparkles
- **Board**: Wood grain, stone texture, or seasonal backdrop

**References**: Bejeweled, Candy Crush (natural themes)

### 9. Terminal / Hacker
**Aesthetic**: Green-screen retro computing
- **Blocks**: ASCII characters or matrix-style symbols (█, ▓, ▒, ░)
- **Typography**: Monospaced (Courier, Consolas) in green
- **Effects**: CRT screen curvature, flicker, scanlines, phosphor glow
- **Colors**: Green-on-black, amber-on-black, or white-on-black
- **Sounds**: Keyboard clicks, terminal beeps
- **Particles**: ASCII character rain, terminal output
- **Board**: Terminal window with prompt, stdout-style score

**References**: The Matrix, Hacknet, old UNIX terminals

### 10. Liquid / Morphing
**Aesthetic**: Soft, blobby, lava lamp vibes
- **Blocks**: Soft rounded edges, merging/morphing animations
- **Typography**: Rounded bubbly fonts
- **Effects**: Metaball merging, fluid dynamics simulation (or faked)
- **Colors**: Bold saturated candy colors (pink, orange, yellow, blue)
- **Sounds**: Squishy blobs, liquid pops
- **Particles**: Blobs splitting and merging, bubble pop effects
- **Board**: Soft gradient background, liquid container appearance

**References**: Slime Rancher, lava lamps, metaball animations

## Requirements

### 1. Theme Selection UI

**Settings Menu:**
- [ ] Add "Theme" section to settings/profile screen
- [ ] Grid or carousel display showing all 10 themes
- [ ] Preview thumbnail for each theme (static or animated)
- [ ] Theme name and short description
- [ ] "Apply" button or instant preview on hover/click
- [ ] Current theme highlighted/selected

**In-Game Theme Switcher:**
- [ ] Optional: Quick theme picker accessible during pause menu
- [ ] Smooth transition when switching themes mid-game
- [ ] Game state preserved when changing theme

**Persistence:**
- [ ] Selected theme saved to user profile (localStorage or Supabase)
- [ ] Theme preference syncs across devices (if logged in)
- [ ] Default theme for new users

### 2. Theme Architecture

#### Theme Definition Structure
Each theme is a TypeScript object containing:

```typescript
interface Theme {
  id: string;
  name: string;
  description: string;

  // Visual properties
  colors: ThemeColors;
  typography: ThemeTypography;
  blocks: BlockStyle;
  board: BoardStyle;
  effects: ThemeEffects;

  // Audio
  sounds: ThemeSounds;

  // Animations & particles
  animations: ThemeAnimations;
  particles: ParticleStyle;

  // CSS variables or class name
  cssVars?: Record<string, string>;
  className?: string;
}

interface ThemeColors {
  // Tetromino colors (I, O, T, S, Z, J, L)
  pieces: {
    I: string;
    O: string;
    T: string;
    S: string;
    Z: string;
    J: string;
    L: string;
  };

  // UI colors
  background: string;
  boardBackground: string;
  gridLines: string;
  text: string;
  textSecondary: string;
  accent: string;

  // Effect colors
  particleColor: string;
  glowColor?: string;
}

interface ThemeTypography {
  fontFamily: string;
  fontSize: {
    title: string;
    score: string;
    label: string;
    button: string;
  };
  fontWeight: {
    normal: number;
    bold: number;
  };
  letterSpacing?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
}

interface BlockStyle {
  // Rendering style
  style: 'flat' | 'gradient' | 'textured' | 'isometric' | 'ascii' | 'glow' | 'glass' | 'sketch';

  // Block properties
  borderRadius: string;
  borderWidth: string;
  borderStyle: string;
  shadow?: string;

  // Special effects
  texture?: string; // URL or data URI
  filter?: string; // CSS filter
  backdrop?: string; // backdrop-filter for glassmorphism

  // Animation properties
  landingAnimation?: 'bounce' | 'squash' | 'shake' | 'glow' | 'none';
  lockAnimation?: 'fade' | 'flash' | 'pulse' | 'none';
}

interface BoardStyle {
  background: string; // color, gradient, or image URL
  gridLineWidth: string;
  gridLineColor: string;
  gridLineStyle: 'solid' | 'dashed' | 'dotted';
  padding: string;
  borderRadius: string;
  shadow?: string;

  // Special overlays
  overlay?: 'scanlines' | 'crt' | 'paper' | 'glass' | 'none';
  overlayOpacity?: number;
}

interface ThemeEffects {
  // Post-processing effects
  blur?: number;
  bloom?: boolean;
  chromaticAberration?: boolean;
  scanlines?: boolean;
  crtCurve?: boolean;
  vignette?: boolean;

  // Transition effects
  transitionDuration: string;
  transitionEasing: string;
}

interface ThemeSounds {
  // Sound effect identifiers or URLs
  move: string;
  rotate: string;
  drop: string;
  lineClear: string;
  gameOver: string;
  abilityActivate: string;

  // Volume multiplier for this theme
  volumeMultiplier?: number;
}

interface ThemeAnimations {
  // Animation durations
  blockLanding: string;
  lineClear: string;
  gameOver: string;

  // Animation styles
  blockFallEasing: string;
  lineClearEffect: 'fade' | 'explode' | 'dissolve' | 'slide';
}

interface ParticleStyle {
  shape: 'circle' | 'square' | 'triangle' | 'star' | 'custom';
  size: { min: number; max: number };
  color: string | string[];
  lifetime: number;
  gravity: number;
  fadeOut: boolean;

  // Special particle types per theme
  customParticle?: string; // Component name or renderer
}
```

#### Theme Registry
```typescript
// themes/index.ts
import { retro8bit } from './retro8bit';
import { neonCyberpunk } from './neonCyberpunk';
import { minimalistFlat } from './minimalistFlat';
// ... import all 10 themes

export const themes: Record<string, Theme> = {
  'retro-8bit': retro8bit,
  'neon-cyberpunk': neonCyberpunk,
  'minimalist-flat': minimalistFlat,
  'glassmorphism': glassmorphism,
  'brutalist': brutalist,
  'isometric-3d': isometric3d,
  'hand-drawn': handDrawn,
  'nature-organic': natureOrganic,
  'terminal-hacker': terminalHacker,
  'liquid-morphing': liquidMorphing,
};

export function getTheme(id: string): Theme {
  return themes[id] || themes['glassmorphism']; // current default
}
```

### 3. Implementation Strategy

#### Phase 1: Extract Current Theme
- [ ] Audit all hardcoded colors, fonts, effects in components
- [ ] Create `themes/glassmorphism.ts` matching current design
- [ ] Replace hardcoded values with theme variables
- [ ] Test that extracted theme looks identical to original

#### Phase 2: Theme Context & Provider
- [ ] Create `ThemeContext` React context
- [ ] Create `ThemeProvider` component wrapping app
- [ ] Provide `currentTheme` and `setTheme()` to all components
- [ ] Load theme from user profile on mount

```typescript
// contexts/ThemeContext.tsx
export const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (themeId: string) => void;
}>({
  theme: getTheme('glassmorphism'),
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState('glassmorphism');
  const theme = useMemo(() => getTheme(themeId), [themeId]);

  // Persist theme to localStorage/Supabase
  useEffect(() => {
    localStorage.setItem('tetris-theme', themeId);
  }, [themeId]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

#### Phase 3: Implement 10 Themes
- [ ] Create `themes/retro8bit.ts` - Retro 8-bit theme
- [ ] Create `themes/neonCyberpunk.ts` - Neon Cyberpunk theme
- [ ] Create `themes/minimalistFlat.ts` - Minimalist Flat theme
- [ ] Create `themes/glassmorphism.ts` - Glassmorphism theme (current)
- [ ] Create `themes/brutalist.ts` - Brutalist theme
- [ ] Create `themes/isometric3d.ts` - Isometric 3D theme
- [ ] Create `themes/handDrawn.ts` - Hand-drawn theme
- [ ] Create `themes/natureOrganic.ts` - Nature/Organic theme
- [ ] Create `themes/terminalHacker.ts` - Terminal/Hacker theme
- [ ] Create `themes/liquidMorphing.ts` - Liquid/Morphing theme

#### Phase 4: Component Updates
Update all visual components to consume theme:

**TetrisBoard.tsx:**
```typescript
const { theme } = useTheme();

<div
  className="tetris-board"
  style={{
    background: theme.board.background,
    borderRadius: theme.board.borderRadius,
    boxShadow: theme.board.shadow,
    // ... apply all board styles
  }}
>
  {/* Render grid lines with theme.board.gridLineColor */}
</div>
```

**TetrominoBlock.tsx:**
```typescript
const { theme } = useTheme();

function renderBlock(type: TetrominoType) {
  const color = theme.colors.pieces[type];

  switch (theme.blocks.style) {
    case 'flat':
      return <div style={{ background: color, borderRadius: theme.blocks.borderRadius }} />;
    case 'isometric':
      return <IsometricBlock color={color} />;
    case 'ascii':
      return <ASCIIBlock char={getASCIIChar(type)} color={color} />;
    case 'glass':
      return <GlassBlock color={color} blur={theme.effects.blur} />;
    // ... handle all styles
  }
}
```

**ParticleSystem.tsx:**
```typescript
const { theme } = useTheme();

function createParticle() {
  return {
    shape: theme.particles.shape,
    color: theme.particles.color,
    size: randomBetween(theme.particles.size.min, theme.particles.size.max),
    lifetime: theme.particles.lifetime,
    // ... use theme particle config
  };
}
```

**SoundManager.ts:**
```typescript
const { theme } = useTheme();

function playSound(soundType: 'move' | 'rotate' | ...) {
  const soundUrl = theme.sounds[soundType];
  const volume = baseVolume * (theme.sounds.volumeMultiplier ?? 1.0);
  playAudio(soundUrl, volume);
}
```

#### Phase 5: Theme Selector UI
- [ ] Create `ThemeSelector.tsx` component
- [ ] Display theme grid with thumbnails
- [ ] Implement theme preview on hover
- [ ] Add to settings/profile screen

```typescript
// components/ThemeSelector.tsx
export function ThemeSelector() {
  const { theme: currentTheme, setTheme } = useTheme();

  return (
    <div className="theme-selector">
      <h2>Choose Your Style</h2>
      <div className="theme-grid">
        {Object.entries(themes).map(([id, theme]) => (
          <ThemeCard
            key={id}
            theme={theme}
            isActive={currentTheme.id === id}
            onClick={() => setTheme(id)}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeCard({ theme, isActive, onClick }: ThemeCardProps) {
  return (
    <div
      className={`theme-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <ThemePreview theme={theme} />
      <h3>{theme.name}</h3>
      <p>{theme.description}</p>
    </div>
  );
}

function ThemePreview({ theme }: { theme: Theme }) {
  // Render mini Tetris board with theme applied
  return (
    <div className="theme-preview" style={{ background: theme.board.background }}>
      {/* Mini grid with a few blocks */}
    </div>
  );
}
```

#### Phase 6: Special Effects Per Theme
Some themes require custom renderers or effects:

**Scanlines Overlay (Retro 8-bit, Terminal):**
```typescript
function ScanlinesOverlay({ opacity = 0.1 }: { opacity?: number }) {
  return (
    <div className="scanlines" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: `repeating-linear-gradient(
        0deg,
        rgba(0, 0, 0, ${opacity}) 0px,
        transparent 2px,
        transparent 4px
      )`,
      pointerEvents: 'none',
    }} />
  );
}
```

**CRT Curve (Retro 8-bit, Terminal):**
```css
.crt-effect {
  filter: brightness(1.1) contrast(1.2);
  animation: crt-flicker 0.15s infinite;
}

@keyframes crt-flicker {
  0% { opacity: 0.98; }
  50% { opacity: 1; }
  100% { opacity: 0.98; }
}
```

**Bloom Effect (Neon Cyberpunk):**
```typescript
// Use CSS filter or canvas-based bloom
<div style={{
  filter: 'blur(2px) brightness(1.5)',
  mixBlendMode: 'screen',
}} />
```

**Isometric Projection (Isometric 3D):**
```typescript
function IsometricBlock({ color, x, y }: IsometricBlockProps) {
  // Transform 2D coordinates to isometric
  const isoX = (x - y) * 30;
  const isoY = (x + y) * 15;

  return (
    <div style={{
      position: 'absolute',
      left: isoX,
      top: isoY,
      width: 60,
      height: 30,
      background: color,
      transform: 'rotateX(60deg) rotateZ(45deg)',
    }}>
      {/* Front, top, and side faces */}
    </div>
  );
}
```

### 4. Asset Requirements

#### Fonts
- [ ] Load Google Fonts or host locally:
  - Press Start 2P (Retro 8-bit)
  - Orbitron (Neon Cyberpunk)
  - Inter (Minimalist Flat)
  - SF Pro Display or Poppins (Glassmorphism)
  - Courier New or IBM Plex Mono (Brutalist, Terminal)
  - Permanent Marker or Indie Flower (Hand-drawn)
  - Lora or Merriweather (Nature)

#### Textures
- [ ] Paper texture (Hand-drawn theme)
- [ ] Wood grain (Nature theme - wooden tiles)
- [ ] Stone texture (Nature theme - stone tiles)
- [ ] Pixel sprites (Retro 8-bit theme)
- [ ] Noise texture (various themes)

#### Sounds
- [ ] Record/source chiptune sounds (Retro 8-bit)
- [ ] Synthwave bass hits (Neon Cyberpunk)
- [ ] Soft clicks (Minimalist)
- [ ] Natural sounds: wood clacks, stone clicks (Nature)
- [ ] Terminal beeps and keyboard clicks (Terminal)
- [ ] Squishy blob sounds (Liquid)

#### Particle Sprites
- [ ] Pixel particle sprites (Retro 8-bit)
- [ ] Neon spark sprites (Neon Cyberpunk)
- [ ] Leaf/petal sprites (Nature)
- [ ] ASCII characters (Terminal)

### 5. Performance Considerations

**Optimization Strategies:**
- [ ] Lazy-load theme assets (fonts, sounds, textures)
- [ ] Cache theme objects to avoid re-computation
- [ ] Use CSS variables for dynamic theming where possible
- [ ] Minimize DOM re-renders when switching themes
- [ ] Preload next theme on hover for instant switching

**CSS Variables Approach:**
```typescript
function applyThemeCSS(theme: Theme) {
  const root = document.documentElement;
  root.style.setProperty('--color-bg', theme.colors.background);
  root.style.setProperty('--color-piece-I', theme.colors.pieces.I);
  root.style.setProperty('--font-family', theme.typography.fontFamily);
  // ... set all CSS variables
}
```

**Bundle Size:**
- [ ] Keep each theme definition small (<5KB)
- [ ] Use code splitting to load theme modules on demand
- [ ] Compress texture images (WebP, optimized PNGs)

## Acceptance Criteria

### Scenario 1: Theme Selection
```
GIVEN user is in settings
WHEN user clicks on "Neon Cyberpunk" theme
THEN game instantly updates to neon aesthetic
AND selection is saved to profile
AND next session loads Neon Cyberpunk automatically
```

### Scenario 2: Mid-Game Theme Change
```
GIVEN user is playing a game
WHEN user changes theme from pause menu
THEN visual style updates without interrupting gameplay
AND game state (score, board, pieces) is preserved
AND new theme renders correctly
```

### Scenario 3: Theme Consistency
```
GIVEN user selects "Retro 8-bit" theme
WHEN user views all screens (menu, gameplay, settings, game over)
THEN ALL screens use Retro 8-bit aesthetic
AND colors, fonts, sounds are consistent throughout
```

### Scenario 4: Theme Preview
```
GIVEN user hovers over "Isometric 3D" theme card
WHEN preview animation plays
THEN user sees mini Tetris board in isometric style
AND can judge visual appeal before applying
```

### Scenario 5: Mobile Responsiveness
```
GIVEN user is on mobile device
WHEN theme is applied
THEN theme looks good on small screen
AND performance is acceptable (60fps)
AND touch interactions work correctly
```

## UI/UX Design

### Theme Selector Layout
```
┌─────────────────────────────────────────────┐
│ Choose Your Style                           │
│                                             │
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐   │
│ │ [8bit]│ │ [Neon]│ │ [Flat]│ │[Glass]│   │
│ │Retro  │ │Cyber  │ │Minimal│ │Morph  │   │
│ │8-bit  │ │punk   │ │Flat   │ │ism    │   │
│ └───────┘ └───────┘ └───────┘ └───────┘   │
│                                             │
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐   │
│ │[Brutal│ │[Iso3D]│ │[Sketch│ │[Nature│   │
│ │ist    │ │       │ │]      │ │]      │   │
│ └───────┘ └───────┘ └───────┘ └───────┘   │
│                                             │
│ ┌───────┐ ┌───────┐                        │
│ │[Term  │ │[Liquid│                        │
│ │inal]  │ │]      │                        │
│ └───────┘ └───────┘                        │
│                                             │
│ ✓ Currently using: Glassmorphism            │
└─────────────────────────────────────────────┘
```

### In-Game Theme Indicator
```
┌─────────────────────────────────────────────┐
│ [Theme: 🎮 Retro 8-bit] [Change]            │
│                                             │
│         ▓▓▓▓                                │
│         ▓▓▓▓                                │
│   ...tetris board...                        │
│                                             │
│ SCORE: 001337                               │
│ STARS: █████                                │
└─────────────────────────────────────────────┘
```

## Testing

### Manual Tests
- [ ] Apply each of 10 themes and verify visual correctness
- [ ] Switch themes mid-game, verify no state loss
- [ ] Test theme persistence across browser refresh
- [ ] Test on mobile devices (iOS, Android)
- [ ] Test with accessibility tools (screen readers, high contrast)

### Automated Tests
- [ ] Unit tests for theme definitions (valid structure)
- [ ] Integration tests for ThemeProvider
- [ ] Snapshot tests for each theme's appearance
- [ ] Performance tests (theme switching <100ms)

### Edge Cases
- [ ] Rapidly switching between themes
- [ ] Theme change during animations
- [ ] Theme change during ability effects
- [ ] Invalid theme ID fallback to default
- [ ] Theme assets fail to load (fallback behavior)

## Success Metrics

- [ ] 10 distinct themes implemented and selectable
- [ ] Theme switching completes in <100ms
- [ ] No FPS drop when applying new theme
- [ ] Theme preference persists across sessions
- [ ] All themes look good on desktop and mobile
- [ ] User testing shows clear visual distinction between themes

## Notes

- **Priority**: MEDIUM - Enhances player experience but not core functionality
- **Complexity**: MEDIUM-HIGH - Requires systematic refactoring of all visuals
- **Player Value**: HIGH - Personalization drives engagement and retention
- **Future Extensibility**: Easy to add more themes later

## Related Features

- Enhances player customization and expression
- Unlockable themes could be added as progression rewards
- Could integrate with battle pass or achievements
- Themes could be sold as cosmetic DLC
- Community could submit custom themes

## Future Enhancements

- [ ] **Custom Theme Editor**: Let players create their own themes
- [ ] **Theme Marketplace**: Share and download community themes
- [ ] **Seasonal Themes**: Auto-switch themes for holidays (Halloween, Christmas)
- [ ] **Dynamic Themes**: Change theme based on score, combo, or game state
- [ ] **Unlockable Themes**: Earn themes through achievements
- [ ] **Animated Themes**: Backgrounds and effects change over time
- [ ] **Theme Presets**: "Dark mode" / "Light mode" toggle
- [ ] **Accessibility Themes**: High contrast, colorblind-friendly options

## Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Extract current theme into `themes/glassmorphism.ts`
- [ ] Create Theme interface and types
- [ ] Create ThemeContext and ThemeProvider
- [ ] Replace hardcoded values with theme variables in 1-2 components
- [ ] Verify glassmorphism theme looks identical to original

### Phase 2: Core Themes (Week 2-3)
- [ ] Implement Retro 8-bit theme
- [ ] Implement Neon Cyberpunk theme
- [ ] Implement Minimalist Flat theme
- [ ] Implement Brutalist theme
- [ ] Implement Terminal/Hacker theme

### Phase 3: Advanced Themes (Week 4)
- [ ] Implement Isometric 3D theme (custom renderer)
- [ ] Implement Hand-drawn theme (textures)
- [ ] Implement Nature/Organic theme (seasonal variants)
- [ ] Implement Liquid/Morphing theme (animation-heavy)

### Phase 4: UI & Polish (Week 5)
- [ ] Create ThemeSelector component
- [ ] Add theme previews
- [ ] Integrate into settings screen
- [ ] Add theme persistence
- [ ] Test all themes on all screens

### Phase 5: Assets & Sounds (Week 6)
- [ ] Source/create fonts for all themes
- [ ] Create texture assets
- [ ] Record/source sound effects per theme
- [ ] Optimize asset loading and caching

### Phase 6: Testing & Launch (Week 7)
- [ ] Manual testing on all devices
- [ ] Performance profiling
- [ ] Accessibility audit
- [ ] Bug fixes and polish
- [ ] Deploy to production

# Game Polish Research - Web Equivalents

## The Problem
Three things make apps feel "ugly":
1. **Lack of motion** - Things pop in/out instead of transitioning
2. **Lack of tactile feedback** - No physical response to actions
3. **Generic visual treatment** - Flat, cramped, amateur spacing

## Web Equivalents for React Native Libraries

### 1. Animation Libraries (vs react-native-reanimated)

**Framer Motion** (Recommended)
```bash
npm install framer-motion
```
- Runs at 60fps using Web Animations API
- Spring physics for natural motion
- Layout animations built-in
- Gesture support included
- Simple API: `<motion.div animate={{ scale: 1.2 }}>`

**React Spring** (Alternative)
```bash
npm install @react-spring/web
```
- Physics-based animations
- Interpolation and chaining
- More control but steeper learning curve

**Recommendation**: Use Framer Motion for quick implementation

### 2. Haptic Feedback (vs expo-haptics)

**Web Vibration API** (Native)
```typescript
// Light tap
navigator.vibrate(10);

// Medium impact
navigator.vibrate(50);

// Heavy impact
navigator.vibrate(100);

// Pattern (double tap)
navigator.vibrate([50, 100, 50]);

// Success notification
navigator.vibrate([10, 20, 10, 20, 10]);

// Error buzz
navigator.vibrate([100, 50, 100]);
```

**Browser Support**:
- ✅ Chrome/Android
- ✅ Firefox
- ❌ Safari/iOS (disabled for privacy reasons)
- Fallback: Silent on iOS, works great on Android

**Implementation**:
```typescript
// utils/haptics.ts
export const haptics = {
  light: () => navigator.vibrate?.(10),
  medium: () => navigator.vibrate?.(50),
  heavy: () => navigator.vibrate?.(100),
  success: () => navigator.vibrate?.([10, 20, 10, 20, 10]),
  error: () => navigator.vibrate?([100, 50, 100]),
};
```

### 3. Visual Polish for Web

**Linear Gradients** (Native CSS)
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

**Glow Effects** (box-shadow)
```css
box-shadow: 0 0 20px rgba(102, 126, 234, 0.6);
```

**Particle Effects**
- **react-particles** - Lightweight particle system
- **Canvas API** - Custom particles
- **CSS animations** - Simple sparkles/flashes

### 4. Animation Patterns for Tetris

#### Spring Animations (Interactive)
```typescript
<motion.div
  animate={{ scale: 1 }}
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
/>
```

#### Smooth Counters
```typescript
<motion.span
  key={score}
  initial={{ y: -20, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  exit={{ y: 20, opacity: 0 }}
/>
```

#### Layout Animations
```typescript
<motion.div layout transition={{ type: "spring" }}>
  {abilities.map(ability => (
    <motion.button key={ability.id} layout />
  ))}
</motion.div>
```

#### Line Clear Effect
```typescript
// 1. Flash white
<motion.div animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.2 }} />

// 2. Shake board
<motion.div animate={{ x: [0, -5, 5, -5, 5, 0] }} transition={{ duration: 0.3 }} />

// 3. Drop rows with stagger
<motion.div
  initial={{ y: -40 }}
  animate={{ y: 0 }}
  transition={{ delay: rowIndex * 0.05 }}
/>
```

### 5. Visual Design Guidelines

#### Color Palette
```typescript
const darkTheme = {
  background: '#0a0a1a', // Not pure black
  primary: '#00d4ff',    // Electric cyan
  secondary: '#c942ff',  // Neon purple
  accent: '#ff006e',     // Hot pink
  success: '#00ff88',    // Electric green
  grid: 'rgba(255,255,255,0.05)', // Subtle grid
};
```

#### Block Styling
```css
.tetris-block {
  /* Gradient for 3D effect */
  background: linear-gradient(145deg, #667eea, #5568c9);

  /* Glow effect */
  box-shadow:
    0 0 10px rgba(102, 126, 234, 0.4),
    inset 0 0 10px rgba(255, 255, 255, 0.1);

  /* Subtle inner highlight */
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  border-left: 1px solid rgba(255, 255, 255, 0.2);
  border-right: 1px solid rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(0, 0, 0, 0.2);
}
```

#### Typography
```css
/* Use tabular numbers for scores */
font-variant-numeric: tabular-nums;

/* System font stack */
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
             'Inter', system-ui, sans-serif;

/* Or pixel font for retro theme */
font-family: 'Press Start 2P', monospace;
```

#### Spacing Scale
```typescript
const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
};
```

### 6. Animation Triggers for Tetris Battle

| Event | Animation | Haptic | Sound |
|-------|-----------|--------|-------|
| Piece locks | Subtle scale pulse | Light (10ms) | Soft click |
| Line clear (1-3) | Flash + drop rows | Medium (50ms) | Swoosh |
| Tetris (4 lines) | Screen shake + particles | Heavy (100ms) | Epic boom |
| Ability activate | Icon spring + glow | Medium (50ms) | Power up |
| Bomb explodes | Screen shake + flash | Heavy pattern | Explosion |
| Opponent attacks you | Red flash border | Error pattern | Warning beep |
| Star counter +1 | Number flies up | Light (10ms) | Coin clink |
| Game over | Fade out + blur | Heavy (100ms) | Defeat sound |
| Victory | Confetti + scale | Success pattern | Victory fanfare |

### 7. Implementation Priority

**Phase 1: Foundation (Day 1)**
1. Install Framer Motion
2. Add haptics utility
3. Create animation variants config

**Phase 2: Core Animations (Day 2)**
1. Animate ability buttons (spring on mount)
2. Animate score counters (number transitions)
3. Add haptics to all button presses
4. Line clear animations

**Phase 3: Polish (Day 3)**
1. Screen shake on impacts
2. Particle effects for bombs
3. Entrance/exit animations for modals
4. Loading states with skeletons

**Phase 4: Theme System (Day 4)**
1. Create theme config structure
2. Implement dark neon theme
3. Add scanline overlay
4. Polish one theme to perfection

## Code Examples

### Animated Ability Button
```typescript
<motion.button
  initial={{ scale: 0, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  transition={{ type: "spring", stiffness: 400 }}
  onClick={() => {
    haptics.medium();
    audioManager.playSfx('ability_activate');
    activateAbility();
  }}
>
  <motion.div
    animate={isActive ? { scale: [1, 1.2, 1] } : {}}
    transition={{ repeat: Infinity, duration: 1 }}
  >
    {icon}
  </motion.div>
</motion.button>
```

### Animated Score Counter
```typescript
function AnimatedCounter({ value }: { value: number }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={value}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: "spring", damping: 25 }}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );
}
```

### Line Clear Effect
```typescript
function LineClearEffect({ rows }: { rows: number[] }) {
  return (
    <>
      {/* Flash */}
      <motion.div
        className="flash-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.8, 0] }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'white',
          pointerEvents: 'none',
        }}
      />

      {/* Shake container */}
      <motion.div
        animate={{ x: [0, -5, 5, -5, 5, 0] }}
        transition={{ duration: 0.4 }}
      />

      {/* Particles */}
      {rows.map(row => (
        <ParticleExplosion key={row} row={row} />
      ))}
    </>
  );
}
```

## Benchmark: Polished Web Games

Study these for reference:
- **Tetris Effect (web version)** - Particle effects, smooth animations
- **Slither.io** - Simple but satisfying feedback loop
- **2048** - Perfect tile animations, haptics on mobile
- **Wordle** - Letter flip animations, shake on wrong guess

## Performance Considerations

- Framer Motion uses Web Animations API (GPU accelerated)
- Haptics are fire-and-forget (no performance impact)
- Keep particle counts reasonable (<100 on screen)
- Use `will-change` CSS for animated elements
- Debounce rapid animations (avoid 60+ per second)

## Testing Plan

1. Test on iPhone (no haptics but animations work)
2. Test on Android (haptics + animations work)
3. Test on low-end devices (reduce particle counts if needed)
4. A/B test with/without animations (measure engagement)

---

**Next Steps**: Start with Phase 1, implement haptics + basic springs, then iterate based on feel.

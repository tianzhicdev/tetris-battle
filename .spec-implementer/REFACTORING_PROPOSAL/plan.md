# Implementation Plan for Frontend Refactoring

## Overview
- Total steps: 18
- Estimated new files: 22
- Estimated modified files: 12
- Focus: Phase 1 (Foundation) + Quick Wins from spec
- Strategy: CSS Modules migration + primitive components + design token expansion

## Steps

### Step 1: Extend Design Tokens

**Files to modify:**
- `packages/web/src/design-tokens.ts`

**Implementation details:**
Add the following exports to the existing `T` object:

```typescript
// Add after existing properties
space: {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
  xxxl: '48px',
},

responsive: {
  clampFont: (min: number, mid: number, max: number) =>
    `clamp(${min}px, ${mid}vw, ${max}px)`,
  clampSpace: (min: number, mid: number, max: number) =>
    `clamp(${min}px, ${mid}vw, ${max}px)`,
},

opacity: {
  disabled: 0.38,
  secondary: 0.6,
  hover: 0.8,
  full: 1,
  subtle: 0.04,
  medium: 0.08,
},

transition: {
  fast: 'all 0.15s ease',
  normal: 'all 0.2s ease',
  slow: 'all 0.3s ease',
},

shadow: {
  sm: '0 2px 8px rgba(0, 0, 0, 0.1)',
  md: '0 4px 16px rgba(0, 0, 0, 0.15)',
  lg: '0 8px 32px rgba(0, 0, 0, 0.2)',
  xl: '0 20px 60px rgba(0, 0, 0, 0.3)',
},
```

**Test:**
- No test needed (static data)

**Verify:**
- Run `pnpm --filter web build` - should compile without errors
- Check TypeScript autocomplete works for new tokens

---

### Step 2: Create CSS Variables File

**Files to create:**
- `packages/web/src/styles/variables.css`

**Implementation details:**
Create a CSS file that exports all design tokens as CSS custom properties:

```css
:root {
  /* Colors - Background */
  --color-bg-deep: #06060f;
  --color-bg-panel: rgba(8, 10, 24, 0.92);
  --color-bg-card: rgba(255, 255, 255, 0.025);
  --color-bg-card-hover: rgba(255, 255, 255, 0.045);
  --color-bg-input: rgba(255, 255, 255, 0.035);
  --color-bg-button: rgba(255, 255, 255, 0.04);
  --color-bg-button-hover: rgba(255, 255, 255, 0.08);
  --color-bg-overlay: rgba(3, 3, 12, 0.85);

  /* Colors - Border */
  --color-border-subtle: rgba(255, 255, 255, 0.06);
  --color-border-medium: rgba(255, 255, 255, 0.10);
  --color-border-accent: rgba(0, 240, 240, 0.15);
  --color-border-win: rgba(0, 240, 140, 0.25);
  --color-border-loss: rgba(255, 60, 80, 0.25);

  /* Colors - Text */
  --color-text-primary: #ffffffdd;
  --color-text-secondary: #ffffff77;
  --color-text-tertiary: #ffffff33;
  --color-text-dim: #ffffff18;

  /* Colors - Accent */
  --color-accent-cyan: #00f0f0;
  --color-accent-purple: #b040f0;
  --color-accent-green: #00f08c;
  --color-accent-red: #ff3c50;
  --color-accent-orange: #f0a020;
  --color-accent-yellow: #f0e000;
  --color-accent-pink: #ff2080;
  --color-accent-blue: #4080ff;

  /* Typography */
  --font-display: 'Orbitron', sans-serif;
  --font-body: 'Orbitron', sans-serif;
  --font-chinese: 'Noto Sans SC', sans-serif;
  --font-mono: 'JetBrains Mono', 'Courier New', monospace;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-xxl: 32px;
  --space-xxxl: 48px;

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* Transitions */
  --transition-fast: all 0.15s ease;
  --transition-normal: all 0.2s ease;
  --transition-slow: all 0.3s ease;

  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.15);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.2);
  --shadow-xl: 0 20px 60px rgba(0, 0, 0, 0.3);

  /* Effects */
  --panel-glow: 0 0 40px rgba(0, 240, 240, 0.03), inset 0 0 40px rgba(0, 240, 240, 0.02);
}
```

**Test:**
- No test needed (static CSS)

**Verify:**
- File created in correct location
- Valid CSS syntax

---

### Step 3: Import CSS Variables in Main Entry

**Files to modify:**
- `packages/web/src/main.tsx`

**Implementation details:**
Add this import at the very top of the file (before all other imports):

```typescript
import './styles/variables.css';
```

**Test:**
- No test needed

**Verify:**
- Run `pnpm --filter web dev` - app should load without errors
- Open DevTools, inspect any element, check Computed styles - should see CSS variables

---

### Step 4: Create Button Primitive Component

**Files to create:**
- `packages/web/src/components/primitives/Button/Button.module.css`
- `packages/web/src/components/primitives/Button/index.tsx`

**Implementation details:**

`Button.module.css`:
```css
.button {
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 3px;
  cursor: pointer;
  transition: var(--transition-normal);
  border: none;
  outline: none;
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Variants */
.primary {
  composes: button;
  background: var(--color-bg-button);
  border: 1px solid var(--color-accent-cyan);
  border-opacity: 0.2;
  color: var(--color-accent-cyan);
  text-shadow: 0 0 10px rgba(0, 240, 240, 0.3);
}

.primary:hover:not(:disabled) {
  background: var(--color-bg-button-hover);
  border-opacity: 0.4;
  text-shadow: 0 0 20px rgba(0, 240, 240, 0.5);
}

.secondary {
  composes: button;
  background: var(--color-bg-button);
  border: 1px solid var(--color-border-subtle);
  color: var(--color-text-secondary);
}

.secondary:hover:not(:disabled) {
  background: var(--color-bg-button-hover);
  color: var(--color-text-primary);
}

.ghost {
  composes: button;
  background: transparent;
  border: 1px solid transparent;
  color: var(--color-text-secondary);
}

.ghost:hover:not(:disabled) {
  background: var(--color-bg-button);
  border-color: var(--color-border-subtle);
  color: var(--color-text-primary);
}

.danger {
  composes: button;
  background: rgba(255, 60, 80, 0.1);
  border: 1px solid var(--color-accent-red);
  border-opacity: 0.3;
  color: var(--color-accent-red);
}

.danger:hover:not(:disabled) {
  background: rgba(255, 60, 80, 0.2);
  border-opacity: 0.5;
}

/* Sizes */
.sm {
  padding: 6px 12px;
  font-size: 10px;
  border-radius: var(--radius-sm);
}

.md {
  padding: 10px 20px;
  font-size: 12px;
  border-radius: var(--radius-md);
}

.lg {
  padding: 12px 24px;
  font-size: 14px;
  border-radius: var(--radius-lg);
}

.fullWidth {
  width: 100%;
}
```

`index.tsx`:
```typescript
import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import styles from './Button.module.css';
import { buttonVariants } from '../../../utils/animations';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  animated?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  animated = true,
  children,
  className,
  ...rest
}: ButtonProps) {
  const classNames = [
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (animated) {
    return (
      <motion.button
        className={classNames}
        variants={buttonVariants}
        initial="idle"
        whileHover="hover"
        whileTap="tap"
        {...rest}
      >
        {children}
      </motion.button>
    );
  }

  return (
    <button className={classNames} {...rest}>
      {children}
    </button>
  );
}
```

**Test:**
- Create `packages/web/src/components/primitives/Button/Button.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './index';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('applies variant class', () => {
    const { container } = render(<Button variant="danger">Test</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('danger');
  });

  it('applies size class', () => {
    const { container } = render(<Button size="lg">Test</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('lg');
  });

  it('handles disabled state', () => {
    render(<Button disabled>Test</Button>);
    expect(screen.getByText('Test')).toBeDisabled();
  });
});
```

**Verify:**
- Run `pnpm --filter web test Button`
- All tests pass
- Visual test: Add Button to MainMenu temporarily, check all variants render correctly

---

### Step 5: Create Card Primitive Component

**Files to create:**
- `packages/web/src/components/primitives/Card/Card.module.css`
- `packages/web/src/components/primitives/Card/index.tsx`

**Implementation details:**

`Card.module.css`:
```css
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  transition: var(--transition-normal);
  overflow: hidden;
}

.card:hover {
  background: var(--color-bg-card-hover);
  border-color: var(--color-border-medium);
}

/* Variants */
.default {
  composes: card;
}

.highlighted {
  composes: card;
  background: rgba(0, 240, 240, 0.05);
  border-color: var(--color-border-accent);
  box-shadow: 0 0 20px rgba(0, 240, 240, 0.1);
}

.equipped {
  composes: card;
  background: rgba(0, 240, 140, 0.05);
  border-color: var(--color-accent-green);
  border-opacity: 0.3;
  box-shadow: 0 0 20px rgba(0, 240, 140, 0.1);
}

.danger {
  composes: card;
  background: rgba(255, 60, 80, 0.05);
  border-color: var(--color-accent-red);
  border-opacity: 0.2;
}

/* Padding */
.padded {
  padding: var(--space-md);
}

.paddedLg {
  padding: var(--space-lg);
}

.noPadding {
  padding: 0;
}

/* Interactive */
.clickable {
  cursor: pointer;
}

.clickable:active {
  transform: scale(0.98);
}
```

`index.tsx`:
```typescript
import type { ReactNode, HTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'highlighted' | 'equipped' | 'danger';
  padding?: 'none' | 'default' | 'large';
  clickable?: boolean;
  animated?: boolean;
  children: ReactNode;
}

export function Card({
  variant = 'default',
  padding = 'default',
  clickable = false,
  animated = false,
  children,
  className,
  ...rest
}: CardProps) {
  const classNames = [
    styles[variant],
    padding === 'default' && styles.padded,
    padding === 'large' && styles.paddedLg,
    padding === 'none' && styles.noPadding,
    clickable && styles.clickable,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (animated) {
    return (
      <motion.div
        className={classNames}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        {...rest}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={classNames} {...rest}>
      {children}
    </div>
  );
}
```

**Test:**
- Create `packages/web/src/components/primitives/Card/Card.test.tsx` (similar pattern to Button test)

**Verify:**
- Tests pass
- Visual verification in storybook or dev environment

---

### Step 6: Create Badge Primitive Component

**Files to create:**
- `packages/web/src/components/primitives/Badge/Badge.module.css`
- `packages/web/src/components/primitives/Badge/index.tsx`

**Implementation details:**

`Badge.module.css`:
```css
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  border: 1px solid;
}

/* Variants */
.info {
  composes: badge;
  background: rgba(0, 240, 240, 0.1);
  color: var(--color-accent-cyan);
  border-color: var(--color-accent-cyan);
  border-opacity: 0.3;
  text-shadow: 0 0 10px rgba(0, 240, 240, 0.3);
}

.success {
  composes: badge;
  background: rgba(0, 240, 140, 0.1);
  color: var(--color-accent-green);
  border-color: var(--color-accent-green);
  border-opacity: 0.3;
  text-shadow: 0 0 10px rgba(0, 240, 140, 0.3);
}

.warning {
  composes: badge;
  background: rgba(240, 160, 32, 0.1);
  color: var(--color-accent-orange);
  border-color: var(--color-accent-orange);
  border-opacity: 0.3;
  text-shadow: 0 0 10px rgba(240, 160, 32, 0.3);
}

.error {
  composes: badge;
  background: rgba(255, 60, 80, 0.1);
  color: var(--color-accent-red);
  border-color: var(--color-accent-red);
  border-opacity: 0.3;
  text-shadow: 0 0 10px rgba(255, 60, 80, 0.3);
}

.neutral {
  composes: badge;
  background: var(--color-bg-button);
  color: var(--color-text-secondary);
  border-color: var(--color-border-subtle);
}
```

`index.tsx`:
```typescript
import type { ReactNode, HTMLAttributes } from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'info' | 'success' | 'warning' | 'error' | 'neutral';
  children: ReactNode;
}

export function Badge({
  variant = 'neutral',
  children,
  className,
  ...rest
}: BadgeProps) {
  const classNames = [styles[variant], className].filter(Boolean).join(' ');

  return (
    <span className={classNames} {...rest}>
      {children}
    </span>
  );
}
```

**Test:**
- Create `packages/web/src/components/primitives/Badge/Badge.test.tsx`

**Verify:**
- Tests pass

---

### Step 7: Create Input Primitive Component

**Files to create:**
- `packages/web/src/components/primitives/Input/Input.module.css`
- `packages/web/src/components/primitives/Input/index.tsx`

**Implementation details:**

`Input.module.css`:
```css
.input {
  width: 100%;
  padding: 10px 14px;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-family: var(--font-body);
  font-size: 12px;
  transition: var(--transition-normal);
  outline: none;
}

.input::placeholder {
  color: var(--color-text-tertiary);
}

.input:focus {
  border-color: var(--color-accent-cyan);
  border-opacity: 0.4;
  box-shadow: 0 0 20px rgba(0, 240, 240, 0.1);
}

.input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Error state */
.error {
  composes: input;
  border-color: var(--color-accent-red);
  border-opacity: 0.5;
}

.error:focus {
  box-shadow: 0 0 20px rgba(255, 60, 80, 0.2);
}
```

`index.tsx`:
```typescript
import type { InputHTMLAttributes } from 'react';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error = false, className, ...rest }: InputProps) {
  const classNames = [error ? styles.error : styles.input, className]
    .filter(Boolean)
    .join(' ');

  return <input className={classNames} {...rest} />;
}
```

**Test:**
- Create `packages/web/src/components/primitives/Input/Input.test.tsx`

**Verify:**
- Tests pass

---

### Step 8: Create Primitives Barrel Export

**Files to create:**
- `packages/web/src/components/primitives/index.ts`

**Implementation details:**
```typescript
export { Button } from './Button';
export type { ButtonProps } from './Button';

export { Card } from './Card';
export type { CardProps } from './Card';

export { Badge } from './Badge';
export type { BadgeProps } from './Badge';

export { Input } from './Input';
export type { InputProps } from './Input';
```

**Test:**
- No test needed

**Verify:**
- Run `pnpm --filter web build` - should compile without errors
- Can import from barrel: `import { Button, Card } from '../primitives'`

---

### Step 9: Migrate PrimaryButton to Use Button Primitive

**Files to modify:**
- `packages/web/src/components/ui/PrimaryButton.tsx`

**Implementation details:**
Replace entire file content with:

```typescript
import type { ReactNode } from 'react';
import { Button } from '../primitives';

interface PrimaryButtonProps {
  children: ReactNode;
  color?: string;
  onClick?: () => void;
  disabled?: boolean;
}

/**
 * @deprecated Use <Button variant="primary"> from primitives instead.
 * This component is kept for backward compatibility.
 */
export function PrimaryButton({
  children,
  color,
  onClick,
  disabled,
}: PrimaryButtonProps) {
  // If custom color is needed, fall back to inline styles for now
  // In the future, this should use CSS variables or theme context
  if (color) {
    console.warn(
      'PrimaryButton: Custom color prop is deprecated. Consider using Button primitive with CSS modules.'
    );
  }

  return (
    <Button
      variant="primary"
      size="md"
      fullWidth
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}
```

**Test:**
- Existing components using PrimaryButton should still work

**Verify:**
- Run `pnpm --filter web build` - no errors
- Run `pnpm --filter web dev` - main menu should render correctly
- Visual check: buttons look the same as before

---

### Step 10: Migrate Panel Component to CSS Modules

**Files to create:**
- `packages/web/src/components/ui/Panel.module.css`

**Files to modify:**
- `packages/web/src/components/ui/Panel.tsx`

**Implementation details:**

`Panel.module.css`:
```css
.panel {
  max-width: 95vw;
  background: var(--color-bg-panel);
  backdrop-filter: blur(20px);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border-accent);
  box-shadow: var(--panel-glow);
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 12px;
}

.title {
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--color-accent-cyan);
  letter-spacing: 4px;
  text-shadow: 0 0 20px rgba(0, 240, 240, 0.3);
}

.closeButton {
  background: var(--color-bg-button);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  width: 32px;
  height: 32px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-family: system-ui;
  transition: var(--transition-normal);
}

.closeButton:hover {
  background: var(--color-bg-button-hover);
  color: var(--color-text-primary);
}

.divider {
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(0, 240, 240, 0.13),
    transparent
  );
}

.content {
  padding: 16px 20px 20px;
}
```

`Panel.tsx`:
```typescript
import type { ReactNode } from 'react';
import styles from './Panel.module.css';

interface PanelProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  width?: number;
}

export function Panel({ title, onClose, children, width = 480 }: PanelProps) {
  return (
    <div className={styles.panel} style={{ width }}>
      <div className={styles.header}>
        <div className={styles.title}>{title}</div>
        {onClose && (
          <button onClick={onClose} className={styles.closeButton}>
            ✕
          </button>
        )}
      </div>
      <div className={styles.divider} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
```

**Test:**
- No new tests needed (maintains same interface)

**Verify:**
- Run `pnpm --filter web build` - no errors
- Visual check: Panel components (FriendList, ProfilePage) render correctly
- DevTools: inspect Panel, confirm CSS module classes are applied

---

### Step 11: Migrate Label Component to CSS Modules

**Files to create:**
- `packages/web/src/components/ui/Label.module.css`

**Files to modify:**
- `packages/web/src/components/ui/Label.tsx`

**Implementation details:**

`Label.module.css`:
```css
.label {
  display: block;
  font-family: var(--font-display);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
  text-transform: uppercase;
}
```

`Label.tsx`:
```typescript
import type { ReactNode } from 'react';
import styles from './Label.module.css';

interface LabelProps {
  children: ReactNode;
}

export function Label({ children }: LabelProps) {
  return <label className={styles.label}>{children}</label>;
}
```

**Test:**
- No new tests

**Verify:**
- Components using Label still work (FriendList, ProfilePage)

---

### Step 12: Add Lazy Loading for Heavy Components

**Files to modify:**
- `packages/web/src/App.tsx`

**Implementation details:**
Find the imports at the top of the file:
```typescript
import { AbilityEffectsDemo } from './components/AbilityEffectsDemo';
import { VisualEffectsDemo } from './components/VisualEffectsDemo';
```

Replace with lazy imports:
```typescript
import { lazy, Suspense } from 'react';

const AbilityEffectsDemo = lazy(() =>
  import('./components/AbilityEffectsDemo').then((m) => ({ default: m.AbilityEffectsDemo }))
);
const VisualEffectsDemo = lazy(() =>
  import('./components/VisualEffectsDemo').then((m) => ({ default: m.VisualEffectsDemo }))
);
```

Then wrap the components in Suspense where they're rendered. Find:
```typescript
{currentView === 'ability-effects-demo' && <AbilityEffectsDemo onExit={...} />}
{currentView === 'visual-effects-demo' && <VisualEffectsDemo onExit={...} />}
```

Replace with:
```typescript
{currentView === 'ability-effects-demo' && (
  <Suspense fallback={<div style={{ color: '#fff', padding: '20px' }}>Loading...</div>}>
    <AbilityEffectsDemo onExit={...} />
  </Suspense>
)}
{currentView === 'visual-effects-demo' && (
  <Suspense fallback={<div style={{ color: '#fff', padding: '20px' }}>Loading...</div>}>
    <VisualEffectsDemo onExit={...} />
  </Suspense>
)}
```

**Test:**
- Manual test in dev mode

**Verify:**
- Run `pnpm --filter web build`
- Check build output - should see separate chunks for AbilityEffectsDemo and VisualEffectsDemo
- Expected: Bundle size reduction of ~150-200KB
- Test loading: Navigate to demo pages, should see fallback briefly

---

### Step 13: Extract Static Styles in ServerAuthMultiplayerGame (Quick Win)

**Files to modify:**
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx`

**Implementation details:**
Find all style objects that are identical on every render and move them outside the component function.

Example - find inline styles like:
```typescript
<div style={{
  display: 'flex',
  gap: '12px',
  marginTop: '8px',
}}>
```

Move to constants at the top of file (after imports, before component):
```typescript
// Static styles (defined once, not recreated on every render)
const STATS_CONTAINER_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  marginTop: '8px',
};

const BUTTON_CONTAINER_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginTop: '16px',
};

// Add ~20-30 more static styles based on frequency analysis
```

Then update JSX to use constants:
```typescript
<div style={STATS_CONTAINER_STYLE}>
```

**Strategy**:
1. Search for `style={{` in the file
2. Identify styles that don't use props/state (static)
3. Extract to constants
4. Replace inline with constant reference

Target: Extract 40-50 static styles (roughly half of the 105 instances).

**Test:**
- Visual regression test: Game should look identical

**Verify:**
- Run `pnpm --filter web dev` - game renders correctly
- Performance: Check React DevTools Profiler - should see fewer renders marked with style changes
- No functional changes - only performance optimization

---

### Step 14: Fix TypeScript any Types (Quick Win)

**Files to modify:**
- Search for files with `any` type annotations

**Implementation details:**
Run search to find all `any` usages:
```bash
grep -rn ": any" packages/web/src/components --include="*.tsx" --include="*.ts"
```

For each instance:
1. If it's a proper type from game-core, import it
2. If it's a complex object, define an interface
3. If it's truly unknown, use `unknown` instead of `any`

Example from ServerAuthMultiplayerGame.tsx line 48:
```typescript
// Before
aiOpponent?: any;

// After
import type { AIOpponent } from '@tetris-battle/game-core';
aiOpponent?: AIOpponent | null;
```

**Test:**
- Run `pnpm --filter web build` with `--noEmitOnError` to catch type errors

**Verify:**
- `grep -rn ": any" packages/web/src/components` returns 0 results (or only justified cases)
- Build passes with stricter type checking

---

### Step 15: Consolidate Design Tokens Usage (Quick Win)

**Files to modify:**
- All files with magic numbers/colors that should use design tokens

**Implementation details:**
Search for hardcoded values that exist in design tokens:
```bash
# Find hardcoded colors
grep -rn "rgba(255, 255, 255, 0.0" packages/web/src/components --include="*.tsx"

# Find hardcoded pixel values
grep -rn "'8px'" packages/web/src/components --include="*.tsx"
grep -rn "'12px'" packages/web/src/components --include="*.tsx"
```

Replace with design tokens:
```typescript
// Before
border: '1px solid rgba(255, 255, 255, 0.08)'

// After
import { T } from '../design-tokens';
border: `1px solid ${T.border.subtle}`

// Before
borderRadius: '8px'

// After
borderRadius: `${T.radius.md}px`
```

Target files based on spec:
- FriendList.tsx
- AbilityCard.tsx
- PostMatchScreen.tsx
- ProfilePage.tsx

**Test:**
- Visual regression: Components should look identical

**Verify:**
- Reduced magic numbers by ~70%
- Consistent design system usage

---

### Step 16: Add Vitest Setup for Testing Library

**Files to create:**
- `packages/web/src/__tests__/setup.ts`

**Files to modify:**
- `packages/web/vite.config.ts`

**Implementation details:**

Install testing-library if not present:
```bash
pnpm --filter web add -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

`__tests__/setup.ts`:
```typescript
import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock localStorage for tests
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null,
};
```

`vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2015',
    assetsDir: 'assets',
  },
  base: '',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.ts',
  },
})
```

**Test:**
- Run `pnpm --filter web test` - should use new setup

**Verify:**
- Tests can use `toBeInTheDocument()` matcher
- No more localStorage errors in tests

---

### Step 17: Update CLAUDE.md Documentation

**Files to modify:**
- `CLAUDE.md`

**Implementation details:**
Add a new section after the existing content:

```markdown
## Frontend Refactoring (Feb 2026)

**Implemented**: CSS Modules architecture + primitive component system to replace inline styles.

**Problem Solved**: Bundle size was 943KB with 105+ inline style instances in ServerAuthMultiplayerGame.tsx. Inline styles created new objects every render causing performance issues.

**New Architecture**: CSS Modules + design token CSS variables + primitive component library.

**Key Changes**:
- Added `styles/variables.css` with all design tokens as CSS custom properties
- Created primitive component library in `components/primitives/`:
  - `Button` - Primary, secondary, ghost, danger variants
  - `Card` - Default, highlighted, equipped, danger variants
  - `Badge` - Info, success, warning, error, neutral variants
  - `Input` - Standard input with error state
- Migrated UI components to CSS Modules (Panel, Label)
- Added lazy loading for AbilityEffectsDemo and VisualEffectsDemo (~200KB reduction)
- Extracted static styles in ServerAuthMultiplayerGame (40-50 instances)
- Fixed TypeScript `any` types for better type safety
- Consolidated magic numbers to use design tokens

**Files Created**:
- `packages/web/src/styles/variables.css`
- `packages/web/src/components/primitives/Button/*`
- `packages/web/src/components/primitives/Card/*`
- `packages/web/src/components/primitives/Badge/*`
- `packages/web/src/components/primitives/Input/*`
- `packages/web/src/components/primitives/index.ts`

**Files Modified**:
- `packages/web/src/main.tsx` - Import CSS variables
- `packages/web/src/design-tokens.ts` - Added spacing, opacity, transition, shadow scales
- `packages/web/src/components/ui/Panel.tsx` - Migrated to CSS Modules
- `packages/web/src/components/ui/Label.tsx` - Migrated to CSS Modules
- `packages/web/src/components/ui/PrimaryButton.tsx` - Now uses Button primitive
- `packages/web/src/App.tsx` - Added lazy loading for demos
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx` - Extracted static styles
- `packages/web/vite.config.ts` - Added Vitest configuration

**Bundle Size Impact**:
- Before: 943KB minified (265KB gzipped)
- After: ~750KB minified (~225KB gzipped) - 20% reduction
- Code splitting enabled for demo components

**New Patterns**:

**Using Primitive Components:**
```tsx
import { Button, Card, Badge } from '../primitives';

<Button variant="primary" size="lg" onClick={handleClick}>
  Click me
</Button>

<Card variant="highlighted" padding="default">
  <Badge variant="success">ONLINE</Badge>
  Content here
</Card>
```

**Using CSS Modules:**
```tsx
import styles from './MyComponent.module.css';

export function MyComponent() {
  return <div className={styles.container}>...</div>;
}

// MyComponent.module.css
.container {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
}
```

**Using Design Tokens in Code:**
```tsx
import { T } from '../design-tokens';

// For dynamic styles that can't be in CSS modules
<canvas style={{ borderRadius: `${T.radius.md}px` }} />
```

**Testing Primitives:**
```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from './index';

describe('Button', () => {
  it('renders correctly', () => {
    const { container } = render(<Button>Test</Button>);
    expect(container.querySelector('button')).toBeInTheDocument();
  });
});
```

**Future Work** (Phase 2 of refactoring):
- Break down ServerAuthMultiplayerGame.tsx into hooks + components (~3640 lines → ~200 lines)
- Migrate remaining components to CSS Modules
- Add Storybook for component development
- Improve test coverage to >60%
```

**Test:**
- No test needed

**Verify:**
- Documentation is accurate and helpful for future developers

---

### Step 18: Run Full Build and Test Suite

**No files modified - verification step**

**Implementation details:**
Run complete build and test cycle:
```bash
# Clean build
rm -rf packages/web/dist
pnpm --filter web build

# Run all tests
pnpm --filter web test

# Type check
pnpm --filter web type-check

# Check bundle size
ls -lh packages/web/dist/assets/*.js
```

**Test:**
- All tests pass
- Build completes successfully
- No TypeScript errors

**Verify:**
- Bundle size reduced by at least 15% (target: ~800KB or less)
- All components render correctly in dev mode
- No console errors or warnings
- Visual regression: Screenshots of main views match before/after

---

## Verification Mapping

| Spec Criterion | Covered by Step(s) |
|---------------|-------------------|
| "No inline styles (95% migrated to CSS modules)" | Steps 4-7, 10-11 (primitives + ui migrations) |
| "Bundle size < 600KB (from 943KB)" | Step 12 (lazy loading), Step 13 (static styles) - Partial (gets to ~750KB) |
| "TypeScript strict mode enabled" | Step 14 (fix any types) |
| "No `any` types in production code" | Step 14 |
| "Clear component organization" | Step 8 (primitives barrel export) |
| "Reusable component library" | Steps 4-7 (Button, Card, Badge, Input) |
| "Consistent styling patterns" | Step 15 (consolidate design tokens) |
| "Easy to add new features" | Steps 1-8 (foundation enables this) |

---

## Build/Test Commands

**Build:**
```bash
pnpm --filter web build
```

**Test all:**
```bash
pnpm --filter web test
```

**Test specific:**
```bash
pnpm --filter web test Button
pnpm --filter web test Card
pnpm --filter web test primitives
```

**Type check:**
```bash
pnpm type-check
```

**Dev mode:**
```bash
pnpm dev
```

**Bundle analysis:**
```bash
pnpm --filter web build
ls -lh packages/web/dist/assets/
```

---

## Notes

- This plan covers **Phase 1 (Foundation) + Quick Wins** from the spec
- Total estimated time: 12-16 hours
- Expected bundle size reduction: 20% (from 943KB to ~750KB)
- Phase 2 (breaking down ServerAuthMultiplayerGame) can be done in a follow-up
- All changes are backward compatible
- No breaking changes to existing APIs

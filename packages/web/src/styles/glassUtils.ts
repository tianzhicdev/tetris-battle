/**
 * Glassmorphism Utility Functions
 * Helper functions to apply glass effects programmatically via inline styles
 */

import type { CSSProperties } from 'react';

export interface GlassOptions {
  blur?: number;
  saturation?: number;
  opacity?: number;
  borderOpacity?: number;
  shadowIntensity?: number;
  color?: string;
  glowColor?: string;
}

/**
 * Generate inline glassmorphism styles
 * @param options Configuration for the glass effect
 * @returns CSSProperties object
 */
export function glassStyle(options: GlassOptions = {}): CSSProperties {
  const {
    blur = 10,
    saturation = 180,
    opacity = 0.1,
    borderOpacity = 0.2,
    shadowIntensity = 0.2,
    color = '255, 255, 255',
  } = options;

  return {
    background: `rgba(${color}, ${opacity})`,
    backdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
    border: `1px solid rgba(${color}, ${borderOpacity})`,
    boxShadow: `0 8px 32px rgba(0, 0, 0, ${shadowIntensity})`,
  };
}

/**
 * Dark glass variant for darker backgrounds
 */
export function glassDark(options: GlassOptions = {}): CSSProperties {
  return glassStyle({
    blur: 12,
    saturation: 180,
    opacity: 0.6,
    borderOpacity: 0.1,
    shadowIntensity: 0.3,
    color: '10, 10, 25',
    ...options,
  });
}

/**
 * Blue-tinted glass for buff abilities
 */
export function glassBlue(options: GlassOptions = {}): CSSProperties {
  const {
    blur = 10,
    saturation = 180,
    glowColor = '0, 212, 255',
  } = options;

  return {
    background: `rgba(${glowColor}, 0.1)`,
    backdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
    border: `1px solid rgba(${glowColor}, 0.3)`,
    boxShadow: `
      0 0 20px rgba(${glowColor}, 0.2),
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 0 15px rgba(${glowColor}, 0.05)
    `,
  };
}

/**
 * Purple-tinted glass for debuff abilities
 */
export function glassPurple(options: GlassOptions = {}): CSSProperties {
  const {
    blur = 10,
    saturation = 180,
    glowColor = '201, 66, 255',
  } = options;

  return {
    background: `rgba(${glowColor}, 0.1)`,
    backdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
    border: `1px solid rgba(${glowColor}, 0.3)`,
    boxShadow: `
      0 0 20px rgba(${glowColor}, 0.2),
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 0 15px rgba(${glowColor}, 0.05)
    `,
  };
}

/**
 * Gold-tinted glass for score/rewards
 */
export function glassGold(options: GlassOptions = {}): CSSProperties {
  const {
    blur = 10,
    saturation = 180,
    glowColor = '255, 215, 0',
  } = options;

  return {
    background: `rgba(${glowColor}, 0.08)`,
    backdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
    border: `1px solid rgba(${glowColor}, 0.3)`,
    boxShadow: `
      0 0 20px rgba(${glowColor}, 0.15),
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 0 15px rgba(${glowColor}, 0.05)
    `,
  };
}

/**
 * Danger/warning glass (red)
 */
export function glassDanger(options: GlassOptions = {}): CSSProperties {
  const {
    blur = 10,
    saturation = 180,
    glowColor = '255, 0, 110',
  } = options;

  return {
    background: `rgba(${glowColor}, 0.1)`,
    backdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
    border: `1px solid rgba(${glowColor}, 0.3)`,
    boxShadow: `
      0 0 20px rgba(${glowColor}, 0.2),
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 0 15px rgba(${glowColor}, 0.05)
    `,
  };
}

/**
 * Success glass (green)
 */
export function glassSuccess(options: GlassOptions = {}): CSSProperties {
  const {
    blur = 10,
    saturation = 180,
    glowColor = '0, 255, 157',
  } = options;

  return {
    background: `rgba(${glowColor}, 0.08)`,
    backdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
    border: `1px solid rgba(${glowColor}, 0.3)`,
    boxShadow: `
      0 0 20px rgba(${glowColor}, 0.15),
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 0 15px rgba(${glowColor}, 0.05)
    `,
  };
}

/**
 * Panel glass - for main UI panels
 */
export function glassPanel(options: GlassOptions = {}): CSSProperties {
  const {
    blur = 15,
    saturation = 180,
  } = options;

  return {
    background: 'rgba(5, 5, 15, 0.7)',
    backdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: `
      0 8px 32px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.1)
    `,
    borderRadius: '12px',
  };
}

/**
 * Modal glass - for dialogs and overlays
 */
export function glassModal(options: GlassOptions = {}): CSSProperties {
  const {
    blur = 20,
    saturation = 200,
  } = options;

  return {
    background: 'rgba(5, 5, 15, 0.85)',
    backdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: `
      0 20px 60px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.15)
    `,
    borderRadius: '16px',
  };
}

/**
 * Mobile-optimized glass (lower blur for performance)
 */
export function glassMobile(options: GlassOptions = {}): CSSProperties {
  return glassStyle({
    blur: 6,
    saturation: 150,
    opacity: 0.7,
    borderOpacity: 0.1,
    shadowIntensity: 0.2,
    color: '10, 10, 25',
    ...options,
  });
}

/**
 * Combine glass style with custom styles
 */
export function mergeGlass(
  glassType: CSSProperties,
  customStyles: CSSProperties = {}
): CSSProperties {
  return {
    ...glassType,
    ...customStyles,
  };
}

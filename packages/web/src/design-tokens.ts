// ============================================================
// DESIGN TOKENS — Single source of truth for Tetris Battle UI
// Based on: /docs/design-system.jsx
// ============================================================

export const T = {
  // Colors
  bg: {
    deep: "#06060f",
    panel: "rgba(8, 10, 24, 0.92)",
    card: "rgba(255, 255, 255, 0.025)",
    cardHover: "rgba(255, 255, 255, 0.045)",
    input: "rgba(255, 255, 255, 0.035)",
    button: "rgba(255, 255, 255, 0.04)",
    buttonHover: "rgba(255, 255, 255, 0.08)",
    overlay: "rgba(3, 3, 12, 0.85)",
  },
  border: {
    subtle: "rgba(255, 255, 255, 0.06)",
    medium: "rgba(255, 255, 255, 0.10)",
    accent: "rgba(0, 240, 240, 0.15)",
    win: "rgba(0, 240, 140, 0.25)",
    loss: "rgba(255, 60, 80, 0.25)",
  },
  text: {
    primary: "#ffffffdd",
    secondary: "#ffffff77",
    tertiary: "#ffffff33",
    dim: "#ffffff18",
  },
  accent: {
    cyan: "#00f0f0",
    purple: "#b040f0",
    green: "#00f08c",
    red: "#ff3c50",
    orange: "#f0a020",
    yellow: "#f0e000",
    pink: "#ff2080",
    blue: "#4080ff",
  },
  // Typography
  font: {
    display: "'Orbitron', sans-serif",
    body: "'Orbitron', sans-serif",
    chinese: "'Noto Sans SC', sans-serif",
    mono: "'JetBrains Mono', 'Courier New', monospace",
  },
  // Spacing
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
  },
  // Effects
  glow: (color: string, intensity: number = 1) =>
    `0 0 ${12 * intensity}px ${color}44, 0 0 ${30 * intensity}px ${color}18`,
  panelGlow: "0 0 40px rgba(0, 240, 240, 0.03), inset 0 0 40px rgba(0, 240, 240, 0.02)",
};

// Helper to create text glow effect
export const textGlow = (color: string, intensity: number = 1) =>
  `0 0 ${20 * intensity}px ${color}44`;

// Helper to create border with accent
export const accentBorder = (color: string, width: number = 1, opacity: string = "33") =>
  `${width}px solid ${color}${opacity}`;

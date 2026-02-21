import { useState } from "react";

// ╔══════════════════════════════════════════════════════════════╗
// ║  STACKCRAFT 2 — UNIFIED DESIGN SYSTEM REFERENCE             ║
// ║  Contains: Tokens, 32 Ability Icons, 5 Control Icons,       ║
// ║  UI Components, and Screen Previews                          ║
// ╚══════════════════════════════════════════════════════════════╝

// ============================================================
// §1  DESIGN TOKENS
// ============================================================
const T = {
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
  font: {
    display: "'Orbitron', sans-serif",
    body: "'Orbitron', sans-serif",
    mono: "'JetBrains Mono', 'Courier New', monospace",
  },
  radius: { sm: 4, md: 8, lg: 12, xl: 16 },
  glow: (color, intensity = 1) => `0 0 ${12 * intensity}px ${color}44, 0 0 ${30 * intensity}px ${color}18`,
  panelGlow: "0 0 40px rgba(0, 240, 240, 0.03), inset 0 0 40px rgba(0, 240, 240, 0.02)",
};

// ============================================================
// §2  ABILITY ICONS (32 total) — (color, size) => SVG
// ============================================================
const abilityIcons = {
  earthquake: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="3" y="22" width="26" height="3" rx="0.5" fill={c} opacity="0.25" />
      <rect x="5" y="18" width="26" height="3" rx="0.5" fill={c} opacity="0.3" />
      <rect x="1" y="14" width="26" height="3" rx="0.5" fill={c} opacity="0.35" />
      <path d="M16 4L13 10L17 14L14 20L17 26L15 30" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <path d="M28 15L30 15" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <path d="M2 19L0 19" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
    </svg>
  ),
  screen_shake: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="7" y="5" width="18" height="16" rx="2" stroke={c} strokeWidth="1.8" opacity="0.8" />
      <rect x="12" y="23" width="8" height="2" rx="1" fill={c} opacity="0.4" />
      <rect x="10" y="8" width="4" height="3" rx="0.5" fill={c} opacity="0.2" />
      <rect x="15" y="8" width="4" height="3" rx="0.5" fill={c} opacity="0.2" />
      <rect x="10" y="12" width="4" height="3" rx="0.5" fill={c} opacity="0.2" />
      <rect x="15" y="12" width="4" height="3" rx="0.5" fill={c} opacity="0.2" />
      <path d="M4 8L2 8" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M4 13L1 13" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M4 18L2 18" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <path d="M28 8L30 8" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M28 13L31 13" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M28 18L30 18" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  ),
  ink_splash: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <circle cx="15" cy="15" r="5.5" fill={c} opacity="0.75" />
      <circle cx="9" cy="10" r="3" fill={c} opacity="0.55" />
      <circle cx="22" cy="12" r="2.8" fill={c} opacity="0.5" />
      <circle cx="20" cy="22" r="3.5" fill={c} opacity="0.6" />
      <circle cx="8" cy="21" r="2.2" fill={c} opacity="0.4" />
      <circle cx="5" cy="15" r="1" fill={c} opacity="0.3" />
      <circle cx="26" cy="8" r="1.2" fill={c} opacity="0.25" />
      <circle cx="24" cy="26" r="0.8" fill={c} opacity="0.2" />
      <circle cx="13" cy="24" r="1" fill={c} opacity="0.3" />
      <path d="M15 20.5L15 24Q15 25.5 14 25.5" stroke={c} strokeWidth="1.3" strokeLinecap="round" opacity="0.4" />
    </svg>
  ),
  mini_blocks: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="3" y="6" width="6" height="6" rx="1" stroke={c} strokeWidth="1" opacity="0.15" strokeDasharray="2 2" />
      <rect x="9" y="6" width="6" height="6" rx="1" stroke={c} strokeWidth="1" opacity="0.15" strokeDasharray="2 2" />
      <rect x="15" y="6" width="6" height="6" rx="1" stroke={c} strokeWidth="1" opacity="0.15" strokeDasharray="2 2" />
      <rect x="9" y="0" width="6" height="6" rx="1" stroke={c} strokeWidth="1" opacity="0.15" strokeDasharray="2 2" />
      <path d="M14 16L18 20" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <path d="M16 20L18 20L18 18" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
      <rect x="19" y="22" width="5" height="5" rx="1" fill={c} opacity="0.7" />
      <rect x="24" y="22" width="5" height="5" rx="1" fill={c} opacity="0.7" />
    </svg>
  ),
  fill_holes: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="4" y="20" width="6" height="5" rx="0.8" fill={c} opacity="0.4" />
      <rect x="22" y="20" width="6" height="5" rx="0.8" fill={c} opacity="0.4" />
      <rect x="4" y="14" width="6" height="5" rx="0.8" fill={c} opacity="0.4" />
      <rect x="22" y="14" width="6" height="5" rx="0.8" fill={c} opacity="0.4" />
      <rect x="4" y="26" width="24" height="3" rx="0.8" fill={c} opacity="0.2" />
      <rect x="11" y="20" width="10" height="5" rx="0.8" stroke={c} strokeWidth="1" strokeDasharray="2 2" opacity="0.25" />
      <rect x="12" y="15" width="8" height="4" rx="1" fill={c} opacity="0.85" />
      <path d="M16 7L16 13" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M13 11L16 14L19 11" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    </svg>
  ),
  clear_rows: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="4" y="10" width="24" height="3.5" rx="0.5" fill={c} opacity="0.15" />
      <rect x="4" y="14.5" width="24" height="3.5" rx="0.5" fill={c} opacity="0.22" />
      <rect x="4" y="19" width="24" height="3.5" rx="0.5" fill={c} opacity="0.3" />
      <rect x="4" y="23.5" width="24" height="3.5" rx="0.5" fill={c} opacity="0.4" />
      <line x1="2" y1="16" x2="30" y2="16" stroke={c} strokeWidth="2.5" opacity="0.85" />
      <path d="M6 14L6 12M8 14L8 13" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      <path d="M26 14L26 12M24 14L24 13" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      <text x="15" y="8" fontFamily="system-ui" fontSize="7" fontWeight="800" fill={c} opacity="0.5" textAnchor="middle">×4</text>
    </svg>
  ),
  random_spawner: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="5" y="8" width="4" height="4" rx="0.8" fill={c} opacity="0.6" />
      <rect x="20" y="6" width="4" height="4" rx="0.8" fill={c} opacity="0.5" />
      <rect x="8" y="20" width="4" height="4" rx="0.8" fill={c} opacity="0.55" />
      <rect x="22" y="22" width="4" height="4" rx="0.8" fill={c} opacity="0.65" />
      <path d="M7 5L7 3M5.5 4L8.5 4" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      <path d="M22 3L22 1M20.5 2L23.5 2" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.35" />
      <path d="M10 17L10 15.5M8.5 16.2L11.5 16.2" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.35" />
      <path d="M24 19L24 17.5M22.5 18.2L25.5 18.2" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      <rect x="2" y="2" width="28" height="28" rx="2" stroke={c} strokeWidth="0.8" strokeDasharray="3 3" opacity="0.12" />
    </svg>
  ),
  garbage_rain: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="4" y="2" width="3.5" height="3.5" rx="0.6" fill={c} opacity="0.3" />
      <rect x="10" y="5" width="3.5" height="3.5" rx="0.6" fill={c} opacity="0.35" />
      <rect x="18" y="3" width="3.5" height="3.5" rx="0.6" fill={c} opacity="0.3" />
      <rect x="24" y="6" width="3.5" height="3.5" rx="0.6" fill={c} opacity="0.25" />
      <rect x="7" y="10" width="3.5" height="3.5" rx="0.6" fill={c} opacity="0.4" />
      <rect x="21" y="11" width="3.5" height="3.5" rx="0.6" fill={c} opacity="0.35" />
      <path d="M8 15L8 18" stroke={c} strokeWidth="0.8" strokeLinecap="round" opacity="0.3" />
      <path d="M16 12L16 16" stroke={c} strokeWidth="0.8" strokeLinecap="round" opacity="0.3" />
      <rect x="3" y="23" width="26" height="3" rx="0.5" fill={c} opacity="0.55" />
      <rect x="3" y="27" width="26" height="3" rx="0.5" fill={c} opacity="0.7" />
      <rect x="14" y="27" width="4" height="3" rx="0.5" fill="#000" opacity="0.5" />
      <rect x="20" y="23" width="4" height="3" rx="0.5" fill="#000" opacity="0.5" />
    </svg>
  ),
  speed_up: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="12" y="18" width="4" height="4" rx="0.5" fill={c} opacity="0.7" />
      <rect x="16" y="18" width="4" height="4" rx="0.5" fill={c} opacity="0.7" />
      <rect x="8" y="18" width="4" height="4" rx="0.5" fill={c} opacity="0.7" />
      <rect x="12" y="14" width="4" height="4" rx="0.5" fill={c} opacity="0.7" />
      <path d="M10 4L10 10" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.25" />
      <path d="M14 2L14 10" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <path d="M18 3L18 10" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <path d="M14 26L14 30" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
      <path d="M12 28.5L14 31L16 28.5" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      <text x="26" y="12" fontFamily="system-ui" fontSize="6" fontWeight="800" fill={c} opacity="0.45">2.5×</text>
    </svg>
  ),
  circle_bomb: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="11" stroke={c} strokeWidth="1.2" strokeDasharray="3 2" opacity="0.25" />
      <rect x="13" y="13" width="6" height="6" rx="1" fill={c} opacity="0.7" />
      <path d="M16 3L16 7" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <path d="M16 25L16 29" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <path d="M3 16L7 16" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <path d="M25 16L29 16" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <path d="M7 7L9.5 9.5" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
      <path d="M22.5 22.5L25 25" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
      <path d="M25 7L22.5 9.5" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
      <path d="M9.5 22.5L7 25" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
      <circle cx="16" cy="16" r="4" fill={c} opacity="0.1" />
    </svg>
  ),
  cascade_multiplier: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M16 4L18.5 11.5L26 12L20.5 17L22 25L16 21L10 25L11.5 17L6 12L13.5 11.5Z" stroke={c} strokeWidth="1.5" fill={c} fillOpacity="0.12" strokeLinejoin="round" />
      <text x="16" y="17.5" fontFamily="system-ui" fontSize="9" fontWeight="900" fill={c} opacity="0.85" textAnchor="middle">×2</text>
      <path d="M4 6L4 3M2.5 4.5L5.5 4.5" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.3" />
      <path d="M28 8L28 5.5M26.5 6.8L29.5 6.8" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.25" />
    </svg>
  ),
  shield: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M16 3L27 8V17C27 22 22 27 16 29C10 27 5 22 5 17V8L16 3Z" stroke={c} strokeWidth="1.8" fill={c} fillOpacity="0.07" strokeLinejoin="round" />
      <path d="M16 7L23 10.5V17C23 20.5 20 24 16 25.5C12 24 9 20.5 9 17V10.5L16 7Z" stroke={c} strokeWidth="0.8" opacity="0.2" strokeLinejoin="round" />
      <path d="M12 16L15 19L21 13" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  ),
  time_warp: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="11" stroke={c} strokeWidth="1.5" opacity="0.35" />
      <circle cx="16" cy="16" r="11" stroke={c} strokeWidth="2" strokeDasharray="17 52" strokeDashoffset="-5" opacity="0.7" />
      <path d="M16 9L16 16L20 20" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx="16" cy="16" r="1.2" fill={c} opacity="0.6" />
      <path d="M3 11C4.5 12.5 4.5 14.5 3 16" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.25" />
      <path d="M29 11C27.5 12.5 27.5 14.5 29 16" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.25" />
      <text x="16" y="30" fontFamily="system-ui" fontSize="5.5" fontWeight="700" fill={c} opacity="0.4" textAnchor="middle">0.5×</text>
    </svg>
  ),
  reverse_controls: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M4 12L14 12" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <path d="M11 9L14 12L11 15" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <text x="3" y="10" fontFamily="system-ui" fontSize="5" fill={c} opacity="0.45">L</text>
      <path d="M28 20L18 20" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <path d="M21 17L18 20L21 23" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <text x="27" y="25" fontFamily="system-ui" fontSize="5" fill={c} opacity="0.45">R</text>
      <path d="M13 18L19 14" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <path d="M13 14L19 18" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
    </svg>
  ),
  mirage: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="6" y="4" width="20" height="24" rx="2" stroke={c} strokeWidth="1" opacity="0.2" />
      <rect x="10" y="7" width="4" height="4" rx="0.5" stroke={c} strokeWidth="0.8" opacity="0.12" strokeDasharray="1.5 1.5" />
      <rect x="14" y="7" width="4" height="4" rx="0.5" stroke={c} strokeWidth="0.8" opacity="0.12" strokeDasharray="1.5 1.5" />
      <rect x="18" y="7" width="4" height="4" rx="0.5" stroke={c} strokeWidth="0.8" opacity="0.12" strokeDasharray="1.5 1.5" />
      <rect x="11" y="14" width="3.5" height="3.5" rx="0.5" fill={c} opacity="0.4" />
      <rect x="15" y="14" width="3.5" height="3.5" rx="0.5" fill={c} opacity="0.4" />
      <rect x="15" y="18" width="3.5" height="3.5" rx="0.5" fill={c} opacity="0.4" />
      <text x="16" y="29" fontFamily="system-ui" fontSize="7" fontWeight="800" fill={c} opacity="0.6" textAnchor="middle">? ? ?</text>
    </svg>
  ),
  gold_digger: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="4" y="18" width="5" height="5" rx="0.5" fill={c} opacity="0.3" />
      <rect x="10" y="18" width="5" height="5" rx="0.5" fill={c} opacity="0.3" />
      <rect x="22" y="18" width="5" height="5" rx="0.5" fill={c} opacity="0.3" />
      <rect x="4" y="24" width="5" height="5" rx="0.5" fill={c} opacity="0.35" />
      <rect x="10" y="24" width="5" height="5" rx="0.5" fill={c} opacity="0.35" />
      <rect x="16" y="24" width="5" height="5" rx="0.5" fill={c} opacity="0.35" />
      <rect x="22" y="24" width="5" height="5" rx="0.5" fill={c} opacity="0.35" />
      <rect x="16" y="18" width="5" height="5" rx="0.5" stroke={c} strokeWidth="0.8" strokeDasharray="2 2" opacity="0.2" />
      <path d="M17.5 19.5L19.5 21.5M19.5 19.5L17.5 21.5" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.45" />
      <rect x="16" y="10" width="3" height="3" rx="0.5" fill={c} opacity="0.35" />
      <rect x="20" y="7" width="3" height="3" rx="0.5" fill={c} opacity="0.25" />
      <path d="M18 16L17 13" stroke={c} strokeWidth="0.8" strokeLinecap="round" opacity="0.3" />
      <path d="M19 16L21 11" stroke={c} strokeWidth="0.8" strokeLinecap="round" opacity="0.3" />
      <text x="8" y="12" fontFamily="system-ui" fontSize="6" fontWeight="700" fill={c} opacity="0.4">−6</text>
    </svg>
  ),
  column_swap: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="5" y="10" width="5" height="18" rx="1" fill={c} opacity="0.35" />
      <rect x="5" y="10" width="5" height="5" rx="1" fill={c} opacity="0.5" />
      <rect x="5" y="16" width="5" height="5" rx="1" fill={c} opacity="0.4" />
      <rect x="22" y="10" width="5" height="18" rx="1" fill={c} opacity="0.2" />
      <rect x="22" y="16" width="5" height="5" rx="1" fill={c} opacity="0.35" />
      <rect x="22" y="22" width="5" height="5" rx="1" fill={c} opacity="0.45" />
      <path d="M12 14L20 14" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M18 12L20 14L18 16" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      <path d="M20 22L12 22" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M14 20L12 22L14 24" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  ),
  purge: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="8" stroke={c} strokeWidth="1.5" opacity="0.3" />
      <circle cx="16" cy="16" r="4" fill={c} opacity="0.15" />
      <path d="M16 2L16 6" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
      <path d="M16 26L16 30" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
      <path d="M2 16L6 16" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
      <path d="M26 16L30 16" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
      <path d="M6 6L9 9" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <path d="M23 23L26 26" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <path d="M26 6L23 9" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <path d="M9 23L6 26" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <path d="M13.5 13.5L18.5 18.5M18.5 13.5L13.5 18.5" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </svg>
  ),
  fog_of_war: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="8" y="6" width="16" height="20" rx="1.5" stroke={c} strokeWidth="1" opacity="0.15" />
      <ellipse cx="12" cy="14" rx="7" ry="4" fill={c} opacity="0.2" />
      <ellipse cx="20" cy="12" rx="6" ry="3.5" fill={c} opacity="0.18" />
      <ellipse cx="16" cy="18" rx="8" ry="4" fill={c} opacity="0.22" />
      <ellipse cx="14" cy="22" rx="6" ry="3" fill={c} opacity="0.15" />
      <ellipse cx="16" cy="14" rx="6" ry="3.5" stroke={c} strokeWidth="1.5" opacity="0.6" />
      <circle cx="16" cy="14" r="1.8" fill={c} opacity="0.5" />
      <path d="M10 20L22 8" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.65" />
    </svg>
  ),
  gravity_well: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="7" y="4" width="4" height="4" rx="0.6" fill={c} opacity="0.35" />
      <rect x="15" y="6" width="4" height="4" rx="0.6" fill={c} opacity="0.3" />
      <rect x="23" y="3" width="4" height="4" rx="0.6" fill={c} opacity="0.3" />
      <rect x="11" y="11" width="4" height="4" rx="0.6" fill={c} opacity="0.4" />
      <rect x="19" y="12" width="4" height="4" rx="0.6" fill={c} opacity="0.35" />
      <path d="M9 9L9 16" stroke={c} strokeWidth="0.8" strokeLinecap="round" opacity="0.25" strokeDasharray="1.5 1.5" />
      <path d="M17 11L17 18" stroke={c} strokeWidth="0.8" strokeLinecap="round" opacity="0.25" strokeDasharray="1.5 1.5" />
      <path d="M25 8L25 18" stroke={c} strokeWidth="0.8" strokeLinecap="round" opacity="0.25" strokeDasharray="1.5 1.5" />
      <rect x="4" y="24" width="24" height="4" rx="0.8" fill={c} opacity="0.5" />
      <rect x="7" y="20" width="4" height="4" rx="0.6" fill={c} opacity="0.55" />
      <rect x="15" y="20" width="4" height="4" rx="0.6" fill={c} opacity="0.55" />
      <rect x="23" y="20" width="4" height="4" rx="0.6" fill={c} opacity="0.55" />
      <path d="M4 28L16 18L28 28" stroke={c} strokeWidth="0.8" opacity="0.15" strokeDasharray="2 2" />
    </svg>
  ),
  overcharge: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M18 3L10 16H16L12 29L24 14H17L21 3Z" fill={c} fillOpacity="0.15" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
      <text x="7" y="11" fontFamily="system-ui" fontSize="6" fontWeight="800" fill={c} opacity="0.5">−40%</text>
      <text x="19" y="28" fontFamily="system-ui" fontSize="5.5" fontWeight="700" fill={c} opacity="0.4">×3</text>
    </svg>
  ),
  clone: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="4" y="6" width="11" height="14" rx="2" stroke={c} strokeWidth="1.2" opacity="0.3" />
      <path d="M7 11L12 11M7 14L11 14M7 17L10 17" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.2" />
      <rect x="17" y="12" width="11" height="14" rx="2" stroke={c} strokeWidth="1.5" fill={c} fillOpacity="0.05" opacity="0.7" />
      <path d="M20 17L25 17M20 20L24 20M20 23L23 23" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      <path d="M13 13L19 16" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <path d="M17 14.5L19 16L17.5 17.5" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
    </svg>
  ),
  rotation_lock: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="6" y="18" width="5" height="5" rx="0.5" fill={c} opacity="0.4" />
      <rect x="11" y="18" width="5" height="5" rx="0.5" fill={c} opacity="0.4" />
      <rect x="16" y="18" width="5" height="5" rx="0.5" fill={c} opacity="0.4" />
      <rect x="11" y="13" width="5" height="5" rx="0.5" fill={c} opacity="0.4" />
      <path d="M23 7A6 6 0 0 1 23 19" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <path d="M21 17L23 19.5L25.5 17.5" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
      <rect x="21" y="10" width="8" height="6" rx="1" fill={c} opacity="0.6" />
      <path d="M23 10V8A2 2 0 0 1 27 8V10" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <circle cx="25" cy="13" r="1" fill="#000" opacity="0.4" />
    </svg>
  ),
  blind_spot: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="7" y="3" width="18" height="26" rx="1.5" stroke={c} strokeWidth="1.2" opacity="0.3" />
      <rect x="9" y="5" width="4" height="3" rx="0.5" fill={c} opacity="0.35" />
      <rect x="14" y="5" width="4" height="3" rx="0.5" fill={c} opacity="0.35" />
      <rect x="9" y="9" width="4" height="3" rx="0.5" fill={c} opacity="0.3" />
      <rect x="14" y="9" width="4" height="3" rx="0.5" fill={c} opacity="0.3" />
      <rect x="19" y="9" width="4" height="3" rx="0.5" fill={c} opacity="0.3" />
      <rect x="7" y="16" width="18" height="13" rx="0 0 1.5 1.5" fill={c} opacity="0.7" />
      <text x="16" y="24" fontFamily="system-ui" fontSize="6" fontWeight="800" fill="#000" opacity="0.5" textAnchor="middle">HIDDEN</text>
    </svg>
  ),
  cross_firebomb: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="2" y="13" width="28" height="6" rx="0.5" fill={c} opacity="0.25" />
      <rect x="13" y="2" width="6" height="28" rx="0.5" fill={c} opacity="0.25" />
      <rect x="13" y="13" width="6" height="6" rx="1" fill={c} opacity="0.75" />
      <path d="M3 16L0 14L1 18Z" fill={c} opacity="0.3" />
      <path d="M29 16L32 14L31 18Z" fill={c} opacity="0.3" />
      <path d="M16 3L14 0L18 1Z" fill={c} opacity="0.3" />
      <path d="M16 29L14 32L18 31Z" fill={c} opacity="0.3" />
      <path d="M11 16L4 16" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <path d="M21 16L28 16" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <path d="M16 11L16 4" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <path d="M16 21L16 28" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    </svg>
  ),
  weird_shapes: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="8" y="8" width="5.5" height="5.5" rx="0.8" fill={c} opacity="0.55" />
      <rect x="13.5" y="8" width="5.5" height="5.5" rx="0.8" fill={c} opacity="0.55" />
      <rect x="19" y="8" width="5.5" height="5.5" rx="0.8" fill={c} opacity="0.55" />
      <rect x="8" y="13.5" width="5.5" height="5.5" rx="0.8" fill={c} opacity="0.55" />
      <rect x="13.5" y="13.5" width="5.5" height="5.5" rx="0.8" stroke={c} strokeWidth="1" strokeDasharray="2 2" opacity="0.2" />
      <rect x="19" y="13.5" width="5.5" height="5.5" rx="0.8" fill={c} opacity="0.55" />
      <rect x="8" y="19" width="5.5" height="5.5" rx="0.8" fill={c} opacity="0.55" />
      <rect x="13.5" y="19" width="5.5" height="5.5" rx="0.8" fill={c} opacity="0.55" />
      <rect x="19" y="19" width="5.5" height="5.5" rx="0.8" fill={c} opacity="0.55" />
      <text x="16.2" y="18" fontFamily="system-ui" fontSize="6" fontWeight="800" fill={c} opacity="0.3" textAnchor="middle">!</text>
    </svg>
  ),
  narrow_escape: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="3" y="4" width="26" height="24" rx="1.5" stroke={c} strokeWidth="0.8" strokeDasharray="2 2" opacity="0.15" />
      <rect x="6" y="4" width="18" height="24" rx="1.5" stroke={c} strokeWidth="1.5" fill={c} fillOpacity="0.04" opacity="0.6" />
      <path d="M2 16L5 16" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M3.5 14L5.5 16L3.5 18" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <path d="M30 16L27 16" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M28.5 14L26.5 16L28.5 18" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <text x="15" y="18" fontFamily="system-ui" fontSize="7" fontWeight="800" fill={c} opacity="0.45" textAnchor="middle">7</text>
    </svg>
  ),
  reflect: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="14" y="4" width="3" height="24" rx="1.5" fill={c} opacity="0.2" />
      <rect x="14.5" y="4" width="2" height="24" rx="1" fill={c} opacity="0.1" />
      <path d="M4 12L13 16" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
      <path d="M10 14L13 16L10.5 17.5" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <path d="M18 16L28 12" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
      <path d="M25.5 10.5L28 12L25 13.5" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <path d="M15.5 13L15.5 11M14 12.5L17 12.5" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.4" />
    </svg>
  ),
  magnet: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="4" y="22" width="5" height="5" rx="0.5" fill={c} opacity="0.3" />
      <rect x="10" y="22" width="5" height="5" rx="0.5" fill={c} opacity="0.3" />
      <rect x="22" y="22" width="5" height="5" rx="0.5" fill={c} opacity="0.3" />
      <rect x="16" y="22" width="5" height="5" rx="0.5" stroke={c} strokeWidth="1" strokeDasharray="2 2" opacity="0.2" />
      <rect x="15" y="8" width="5" height="5" rx="0.8" fill={c} opacity="0.7" />
      <path d="M17.5 14L17.5 20" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" strokeDasharray="2 2" />
      <path d="M14 17Q17.5 19 21 17" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.25" />
      <path d="M13 15Q17.5 17 22 15" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.2" />
      <path d="M12 4V8A5.5 5.5 0 0 0 23 8V4" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <path d="M12 4L12 2" stroke={c} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      <path d="M23 4L23 2" stroke={c} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  ),
  quicksand: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="5" y="8" width="22" height="4" rx="0.5" fill={c} opacity="0.2" />
      <rect x="5" y="13" width="22" height="4" rx="0.5" fill={c} opacity="0.25" />
      <rect x="5" y="18" width="22" height="4" rx="0.5" fill={c} opacity="0.4" />
      <rect x="5" y="23" width="22" height="4" rx="0.5" fill={c} opacity="0.5" />
      <path d="M3 28Q8 26 11 28Q14 30 18 28Q22 26 26 28Q29 29 32 28" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <path d="M3 30Q8 28 11 30Q14 32 18 30Q22 28 26 30" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.2" />
      <path d="M16 22L16 28" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M14 26L16 28.5L18 26" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <text x="28" y="8" fontFamily="system-ui" fontSize="5" fontWeight="700" fill={c} opacity="0.35">×3</text>
    </svg>
  ),
  shapeshifter: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="3" y="6" width="3.5" height="3.5" rx="0.5" fill={c} opacity="0.15" />
      <rect x="6.5" y="6" width="3.5" height="3.5" rx="0.5" fill={c} opacity="0.15" />
      <rect x="10" y="6" width="3.5" height="3.5" rx="0.5" fill={c} opacity="0.15" />
      <rect x="6.5" y="2.5" width="3.5" height="3.5" rx="0.5" fill={c} opacity="0.15" />
      <rect x="10" y="15" width="4" height="4" rx="0.5" fill={c} opacity="0.35" />
      <rect x="14" y="15" width="4" height="4" rx="0.5" fill={c} opacity="0.35" />
      <rect x="6" y="19" width="4" height="4" rx="0.5" fill={c} opacity="0.35" />
      <rect x="10" y="19" width="4" height="4" rx="0.5" fill={c} opacity="0.35" />
      <rect x="19" y="24" width="3" height="3" rx="0.5" fill={c} opacity="0.65" />
      <rect x="22" y="24" width="3" height="3" rx="0.5" fill={c} opacity="0.65" />
      <rect x="25" y="24" width="3" height="3" rx="0.5" fill={c} opacity="0.65" />
      <rect x="28" y="24" width="3" height="3" rx="0.5" fill={c} opacity="0.65" />
      <path d="M12 12L12 14" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.3" />
      <path d="M18 21L21 23" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.3" />
      <path d="M22 6L22 3.5M20.5 4.8L23.5 4.8" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.3" />
      <path d="M27 15L27 13M25.5 14L28.5 14" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.25" />
    </svg>
  ),
  shrink_ceiling: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="6" y="3" width="20" height="26" rx="1.5" stroke={c} strokeWidth="1" opacity="0.2" />
      <line x1="6" y1="12" x2="26" y2="12" stroke={c} strokeWidth="2" opacity="0.7" />
      <path d="M8 12L8 10" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <path d="M24 12L24 10" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <path d="M12 4L12 10" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <path d="M10 8L12 10.5L14 8" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
      <path d="M20 4L20 10" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <path d="M18 8L20 10.5L22 8" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
      <rect x="9" y="14" width="4" height="3" rx="0.5" fill={c} opacity="0.25" />
      <rect x="14" y="14" width="4" height="3" rx="0.5" fill={c} opacity="0.25" />
      <text x="16" y="8" fontFamily="system-ui" fontSize="5.5" fontWeight="800" fill={c} opacity="0.5" textAnchor="middle">−3</text>
    </svg>
  ),
  wide_load: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="7" y="4" width="18" height="24" rx="1.5" stroke={c} strokeWidth="1" strokeDasharray="2 2" opacity="0.2" />
      <rect x="2" y="4" width="28" height="24" rx="1.5" stroke={c} strokeWidth="1.5" fill={c} fillOpacity="0.03" opacity="0.5" />
      <path d="M7 16L3 16" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M5 14L3 16L5 18" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <path d="M25 16L29 16" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M27 14L29 16L27 18" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <text x="16" y="18" fontFamily="system-ui" fontSize="8" fontWeight="800" fill={c} opacity="0.4" textAnchor="middle">12</text>
    </svg>
  ),
  tilt: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="6" y="3" width="20" height="26" rx="1.5" stroke={c} strokeWidth="1" opacity="0.2" />
      <path d="M12 5L22 25" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <path d="M19 23L22 25.5L22.5 21.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <rect x="13" y="8" width="4" height="4" rx="0.6" fill={c} opacity="0.35" />
      <rect x="17" y="8" width="4" height="4" rx="0.6" fill={c} opacity="0.35" />
      <rect x="15" y="14" width="3" height="3" rx="0.5" fill={c} opacity="0.2" />
      <rect x="17" y="18" width="3" height="3" rx="0.5" fill={c} opacity="0.15" />
      <rect x="19" y="22" width="3" height="3" rx="0.5" fill={c} opacity="0.1" />
    </svg>
  ),
  flip_board: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="3" y="4" width="11" height="14" rx="1" stroke={c} strokeWidth="1" opacity="0.2" />
      <rect x="5" y="14" width="3" height="2" rx="0.3" fill={c} opacity="0.2" />
      <rect x="8" y="14" width="3" height="2" rx="0.3" fill={c} opacity="0.2" />
      <rect x="5" y="12" width="3" height="2" rx="0.3" fill={c} opacity="0.15" />
      <rect x="18" y="14" width="11" height="14" rx="1" stroke={c} strokeWidth="1.3" opacity="0.5" />
      <rect x="20" y="16" width="3" height="2" rx="0.3" fill={c} opacity="0.45" />
      <rect x="23" y="16" width="3" height="2" rx="0.3" fill={c} opacity="0.45" />
      <rect x="23" y="18" width="3" height="2" rx="0.3" fill={c} opacity="0.35" />
      <path d="M14 8A7 7 0 0 1 20 18" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M18 16.5L20 19L21.5 16" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <text x="16" y="6" fontFamily="system-ui" fontSize="5" fontWeight="700" fill={c} opacity="0.35">180°</text>
    </svg>
  ),
  death_cross: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="4" y="4" width="24" height="24" rx="2" stroke={c} strokeWidth="0.8" opacity="0.12" />
      <path d="M5 5L27 27" stroke={c} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <path d="M27 5L5 27" stroke={c} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <rect x="3" y="3" width="4" height="4" rx="0.5" fill={c} opacity="0.2" />
      <rect x="25" y="3" width="4" height="4" rx="0.5" stroke={c} strokeWidth="0.8" opacity="0.3" />
      <rect x="3" y="25" width="4" height="4" rx="0.5" stroke={c} strokeWidth="0.8" opacity="0.3" />
      <rect x="25" y="25" width="4" height="4" rx="0.5" fill={c} opacity="0.2" />
      <circle cx="16" cy="16" r="3.5" fill="#000" opacity="0.5" />
      <path d="M14 14.5L18 17.5M18 14.5L14 17.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <circle cx="16" cy="16" r="1" fill={c} opacity="0.6" />
    </svg>
  ),
};

// ============================================================
// §3  CONTROL ICONS (5 total) — (color, size) => SVG
// ============================================================
const controlIcons = {
  left: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M20 7L11 16L20 25" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  right: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M12 7L21 16L12 25" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  rotate: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M22 8A9 9 0 1 0 24 18" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M19 5L22.5 8.5L18.5 11" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  down: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M7 13L16 22L25 13" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  drop: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M8 9L16 17L24 9" stroke={c} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 17L16 25L24 17" stroke={c} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// ============================================================
// §4  ICON WRAPPER COMPONENT
// ============================================================
function Icon({ type = "ability", name, color = "#fff", size = 32, glow = false, active = false }) {
  const lib = type === "control" ? controlIcons : abilityIcons;
  const render = lib[name];
  if (!render) return null;
  const displayColor = active ? color : type === "control" ? color : "#ffffffcc";
  return (
    <div style={{
      filter: glow || active ? `drop-shadow(0 0 6px ${color}88)` : "none",
      transition: "filter 0.2s",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>{render(displayColor, size)}</div>
  );
}

// ============================================================
// §5  UI COMPONENTS
// ============================================================

function Panel({ title, onClose, children, width = 480 }) {
  return (
    <div style={{
      width, maxWidth: "95vw",
      background: T.bg.panel, backdropFilter: "blur(20px)",
      borderRadius: T.radius.xl, border: `1px solid ${T.border.accent}`,
      boxShadow: T.panelGlow, overflow: "hidden",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 12px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: T.font.display, color: T.accent.cyan, letterSpacing: 4, textShadow: `0 0 20px ${T.accent.cyan}44` }}>{title}</div>
        {onClose && (
          <button onClick={onClose} style={{ background: T.bg.button, border: `1px solid ${T.border.subtle}`, borderRadius: T.radius.sm, color: T.text.secondary, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontFamily: "system-ui" }}>✕</button>
        )}
      </div>
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${T.accent.cyan}22, transparent)` }} />
      <div style={{ padding: "16px 20px 20px" }}>{children}</div>
    </div>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: `1px solid ${T.border.subtle}` }}>
      {tabs.map(tab => (
        <button key={tab} onClick={() => onChange(tab)} style={{
          flex: 1, padding: "10px 0",
          background: active === tab ? "rgba(0,240,240,0.06)" : "transparent",
          border: "none", borderBottom: active === tab ? `2px solid ${T.accent.cyan}` : "2px solid transparent",
          color: active === tab ? T.accent.cyan : T.text.secondary,
          fontFamily: T.font.body, fontSize: 10, fontWeight: 600, letterSpacing: 2, cursor: "pointer", transition: "all 0.2s",
        }}>{tab}</button>
      ))}
    </div>
  );
}

function Input({ placeholder, button }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input placeholder={placeholder} style={{ flex: 1, background: T.bg.input, border: `1px solid ${T.border.subtle}`, borderRadius: T.radius.md, padding: "10px 14px", color: T.text.primary, fontFamily: T.font.mono, fontSize: 12, outline: "none" }} />
      {button && <button style={{ background: T.bg.button, border: `1px solid ${T.accent.cyan}33`, borderRadius: T.radius.md, color: T.accent.cyan, fontFamily: T.font.display, fontSize: 10, fontWeight: 700, padding: "0 18px", cursor: "pointer", letterSpacing: 2 }}>{button}</button>}
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 9, color: T.text.tertiary, fontFamily: T.font.body, letterSpacing: 3, marginBottom: 6, textTransform: "uppercase" }}>{children}</div>;
}

function StatBadge({ value, label, color = T.accent.cyan }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 22, fontWeight: 900, fontFamily: T.font.display, color, textShadow: `0 0 14px ${color}44`, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 8, color: T.text.tertiary, letterSpacing: 2, marginTop: 6, fontFamily: T.font.body }}>{label}</div>
    </div>
  );
}

function MatchRow({ result, opponent, date, coins }) {
  const isWin = result === "WIN";
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", background: T.bg.card, borderRadius: T.radius.md, borderLeft: `3px solid ${isWin ? T.accent.green : T.accent.red}55`, marginBottom: 6 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, fontFamily: T.font.display, color: isWin ? T.accent.green : T.accent.red, letterSpacing: 2 }}>{result}</div>
        <div style={{ fontSize: 10, color: T.text.secondary, fontFamily: T.font.mono, marginTop: 2 }}>vs {opponent}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.accent.yellow, fontFamily: T.font.mono }}>+{coins}</div>
        <div style={{ fontSize: 8, color: T.text.tertiary, marginTop: 2 }}>{date}</div>
      </div>
    </div>
  );
}

function AbilityCard({ icon, name, cost, desc, color, equipped, onClick }) {
  return (
    <div onClick={onClick} style={{ background: equipped ? `${color}08` : T.bg.card, border: `1px solid ${equipped ? color + "33" : T.border.subtle}`, borderRadius: T.radius.md, padding: 12, cursor: "pointer", transition: "all 0.2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Icon name={icon} color={color} size={24} active={equipped} />
        <div style={{ flex: 1, fontSize: 11, fontWeight: 700, fontFamily: T.font.display, color: T.text.primary, letterSpacing: 1 }}>{name}</div>
        <div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.accent.purple }}>★{cost}</div>
      </div>
      <div style={{ fontSize: 10, color: T.text.secondary, lineHeight: 1.5, fontFamily: "system-ui", marginBottom: 8 }}>{desc}</div>
      <button style={{ width: "100%", padding: "6px 0", background: equipped ? `${color}11` : T.bg.button, border: `1px solid ${equipped ? color + "44" : T.border.subtle}`, borderRadius: T.radius.sm, color: equipped ? color : T.text.secondary, fontFamily: T.font.display, fontSize: 8, fontWeight: 700, letterSpacing: 2, cursor: "pointer" }}>{equipped ? "EQUIPPED" : "EQUIP"}</button>
    </div>
  );
}

function SkillButton({ icon, cost, color, active, canAfford, onClick }) {
  return (
    <div onClick={canAfford ? onClick : undefined} style={{ width: 52, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: canAfford ? "pointer" : "default", opacity: active ? 1 : canAfford ? 0.32 : 0.1, transition: "all 0.25s ease", padding: "6px 0" }}>
      <Icon name={icon} color={color} size={28} active={active} />
      <div style={{ fontSize: 7, color: active ? `${color}cc` : "#ffffff33", fontFamily: T.font.display, letterSpacing: 1, transition: "color 0.25s" }}>★{cost}</div>
    </div>
  );
}

function PrimaryButton({ children, color = T.accent.cyan }) {
  return (
    <button style={{ width: "100%", padding: "12px 0", background: T.bg.button, border: `1px solid ${color}33`, borderRadius: T.radius.md, color, fontFamily: T.font.display, fontSize: 12, fontWeight: 700, letterSpacing: 3, cursor: "pointer", textShadow: `0 0 10px ${color}44`, transition: "all 0.2s" }}>{children}</button>
  );
}

function CoinsBadge({ amount }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", background: `${T.accent.yellow}0f`, border: `1px solid ${T.accent.yellow}22`, borderRadius: 20 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: T.accent.yellow, fontFamily: T.font.mono, textShadow: `0 0 8px ${T.accent.yellow}33` }}>{amount.toLocaleString()}</span>
      <span style={{ fontSize: 8, color: T.accent.yellow + "88" }}>✦</span>
    </div>
  );
}

function ControlButton({ icon, wide, pressed, onPress }) {
  return (
    <button onPointerDown={onPress} style={{
      width: wide ? 58 : 48, height: 48,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: pressed ? "rgba(0,240,240,0.08)" : "rgba(255,255,255,0.025)",
      border: pressed ? "1px solid rgba(0,240,240,0.2)" : "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10, cursor: "pointer", transition: "all 0.1s",
      WebkitTapHighlightColor: "transparent",
    }}>
      <Icon type="control" name={icon} color={pressed ? "#00f0f0" : "#ffffff30"} size={24} />
    </button>
  );
}

function ResultScreen({ victory = true }) {
  const color = victory ? T.accent.green : T.accent.red;
  const title = victory ? "VICTORY" : "DEFEAT";
  return (
    <div style={{ textAlign: "center", padding: "8px 0" }}>
      <div style={{ fontSize: 32, fontWeight: 900, fontFamily: T.font.display, color, textShadow: `0 0 30px ${color}66, 0 0 60px ${color}22`, letterSpacing: 6, marginBottom: 24 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {[{ label: "Score", value: "4,280" }, { label: "Lines Cleared", value: "12" }, { label: "Stars Earned", value: "190", color: T.accent.purple }].map(st => (
          <div key={st.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: T.bg.card, borderRadius: T.radius.md }}>
            <span style={{ fontSize: 11, color: T.text.secondary, fontFamily: T.font.body, letterSpacing: 1 }}>{st.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: st.color || T.text.primary, fontFamily: T.font.mono, textShadow: st.color ? `0 0 8px ${st.color}44` : "none" }}>{st.value}</span>
          </div>
        ))}
      </div>
      <div style={{ background: `${T.accent.green}0a`, border: `1px solid ${T.accent.green}18`, borderRadius: T.radius.md, padding: 14, marginBottom: 20 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.accent.green, letterSpacing: 3, marginBottom: 10, fontFamily: T.font.display }}>REWARDS</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: T.text.secondary }}>Coins Earned</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.accent.yellow, fontFamily: T.font.mono }}>+100</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: T.text.secondary }}>Total Balance</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.accent.yellow, fontFamily: T.font.mono }}>184,140</span>
        </div>
      </div>
      <PrimaryButton color={T.accent.cyan}>CONTINUE</PrimaryButton>
    </div>
  );
}

// ============================================================
// §6  ABILITY DATA (for showcase)
// ============================================================
const ABILITIES = [
  { id: "earthquake", name: "Earthquake", cost: 40, tier: 1, color: "#00f0f0", desc: "Shift opponent's rows 1 cell left or right randomly" },
  { id: "screen_shake", name: "Screen Shake", cost: 40, tier: 1, color: "#ff6090", desc: "Shake opponent's screen for 5 seconds" },
  { id: "ink_splash", name: "Ink Splash", cost: 35, tier: 1, color: "#b040f0", desc: "Splatter 5 opaque ink blobs on opponent's board" },
  { id: "mini_blocks", name: "Mini Blocks", cost: 35, tier: 1, color: "#ff40a0", desc: "Your next 5 pieces become 2-cell dominoes" },
  { id: "fill_holes", name: "Fill Holes", cost: 75, tier: 1, color: "#40ff90", desc: "Fill up to 4 enclosed empty cells on your board" },
  { id: "clear_rows", name: "Clear Rows", cost: 100, tier: 1, color: "#f0e000", desc: "Instantly clear your bottom 4 rows" },
  { id: "random_spawner", name: "Random Spawner", cost: 45, tier: 2, color: "#f0a020", desc: "Spawn 4 random isolated blocks on opponent's board" },
  { id: "garbage_rain", name: "Garbage Rain", cost: 55, tier: 2, color: "#ff6040", desc: "Add 2 garbage rows to opponent's board" },
  { id: "speed_up", name: "Speed Up", cost: 60, tier: 2, color: "#ff3c50", desc: "Opponent's pieces fall 2.5x faster for 8 seconds" },
  { id: "circle_bomb", name: "Circle Bomb", cost: 65, tier: 2, color: "#ff6040", desc: "Next piece explodes in 3-cell radius on placement" },
  { id: "cascade_multiplier", name: "Cascade ×2", cost: 70, tier: 2, color: "#f0e000", desc: "Double stars from line clears for 15 seconds" },
  { id: "shield", name: "Shield", cost: 80, tier: 2, color: "#4080ff", desc: "Block next enemy ability. 15s or until triggered" },
  { id: "time_warp", name: "Time Warp", cost: 50, tier: 2, color: "#40ffcc", desc: "Slow your pieces to 0.5x for 10 seconds" },
  { id: "reverse_controls", name: "Reverse", cost: 70, tier: 3, color: "#ff2080", desc: "Swap opponent's left/right for 6 seconds" },
  { id: "mirage", name: "Mirage", cost: 75, tier: 3, color: "#b040f0", desc: "Opponent's preview shows wrong pieces for 5s" },
  { id: "gold_digger", name: "Gold Digger", cost: 75, tier: 3, color: "#f0a020", desc: "Remove 6 random filled cells from opponent" },
  { id: "column_swap", name: "Column Swap", cost: 85, tier: 3, color: "#00f0f0", desc: "Swap two random columns on opponent's board" },
  { id: "purge", name: "Purge", cost: 60, tier: 3, color: "#ffffff", desc: "Remove ALL active effects from both players" },
  { id: "fog_of_war", name: "Fog of War", cost: 90, tier: 3, color: "#8080a0", desc: "Opponent can't see YOUR board for 8 seconds" },
  { id: "gravity_well", name: "Gravity Well", cost: 85, tier: 3, color: "#b040f0", desc: "Collapse all floating blocks on opponent's board" },
  { id: "overcharge", name: "Overcharge", cost: 50, tier: 3, color: "#f0e000", desc: "Next 3 abilities cost 40% less stars" },
  { id: "clone", name: "Clone", cost: 65, tier: 3, color: "#40ffcc", desc: "Copy and cast opponent's last ability" },
  { id: "rotation_lock", name: "Rotation Lock", cost: 85, tier: 4, color: "#ff3c50", desc: "Disable opponent's rotation for 4 seconds" },
  { id: "blind_spot", name: "Blind Spot", cost: 100, tier: 4, color: "#4040a0", desc: "Hide bottom 5 rows of opponent's board for 5s" },
  { id: "cross_firebomb", name: "Cross Fire", cost: 100, tier: 4, color: "#ff6040", desc: "Next piece explodes in cross: 3 rows + 3 columns" },
  { id: "weird_shapes", name: "Weird Shapes", cost: 100, tier: 4, color: "#ff40a0", desc: "Opponent's next piece is a 3×3 hollow frame" },
  { id: "narrow_escape", name: "Narrow Escape", cost: 100, tier: 4, color: "#40ff90", desc: "Narrow YOUR board to 7 columns for 15 seconds" },
  { id: "reflect", name: "Reflect", cost: 90, tier: 4, color: "#00f0f0", desc: "Reflect next enemy ability back at them" },
  { id: "magnet", name: "Magnet", cost: 90, tier: 4, color: "#4080ff", desc: "Next 3 pieces snap to optimal column" },
  { id: "quicksand", name: "Quicksand", cost: 110, tier: 4, color: "#f0a020", desc: "Opponent's bottom 2 rows sink every 4s for 12s" },
  { id: "shapeshifter", name: "Shapeshifter", cost: 110, tier: 5, color: "#b040f0", desc: "Opponent's next 3 pieces morph every 400ms" },
  { id: "shrink_ceiling", name: "Shrink Ceiling", cost: 110, tier: 5, color: "#ff3c50", desc: "Lower top-out line by 3 rows for 12 seconds" },
  { id: "wide_load", name: "Wide Load", cost: 120, tier: 5, color: "#4080ff", desc: "Widen opponent's board to 12 columns for 15s" },
  { id: "tilt", name: "Tilt", cost: 160, tier: 5, color: "#ff2080", desc: "Pieces drift diagonally for 10 seconds" },
  { id: "flip_board", name: "Flip Board", cost: 180, tier: 5, color: "#f0a020", desc: "Rotate opponent's board 180°" },
  { id: "death_cross", name: "Death Cross", cost: 250, tier: 5, color: "#ff3c50", desc: "Invert both diagonals on opponent's board" },
];

const TIER_COLORS = { 1: "#ffffff", 2: "#40ff90", 3: "#4080ff", 4: "#b040f0", 5: "#ff3c50" };
const TIER_LABELS = { 1: "TIER 1 · FREE", 2: "TIER 2 · 100¢", 3: "TIER 3 · 300¢", 4: "TIER 4 · 600¢", 5: "TIER 5 · 1200¢" };

// ============================================================
// §7  MAIN SHOWCASE
// ============================================================
export default function StackcraftDesignSystem() {
  const [view, setView] = useState("icons");
  const [friendTab, setFriendTab] = useState("FRIENDS");
  const [activeSkill, setActiveSkill] = useState(null);
  const [equipped, setEquipped] = useState(new Set([0, 4]));
  const [pressedCtrl, setPressedCtrl] = useState(null);

  const views = ["icons", "controls", "skill-bar", "abilities", "friends", "profile", "victory", "defeat"];

  return (
    <div style={{
      minHeight: "100vh",
      background: T.bg.deep,
      fontFamily: T.font.body,
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 20,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#fff", letterSpacing: 6 }}>STACKCRAFT 2</div>
        <div style={{ fontSize: 8, color: "#ffffff33", letterSpacing: 3, marginTop: 2 }}>DESIGN SYSTEM REFERENCE</div>
      </div>

      {/* Nav */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
        {views.map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            background: view === v ? T.bg.cardHover : T.bg.button,
            border: `1px solid ${view === v ? T.accent.cyan + "33" : T.border.subtle}`,
            borderRadius: 6, padding: "5px 12px", cursor: "pointer",
            color: view === v ? T.accent.cyan : T.text.secondary,
            fontFamily: T.font.display, fontSize: 8, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase",
          }}>{v}</button>
        ))}
      </div>

      {/* ---- ALL 32 ICONS ---- */}
      {view === "icons" && (
        <div style={{ maxWidth: 800 }}>
          {[1,2,3,4,5].map(tier => (
            <div key={tier} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: TIER_COLORS[tier], letterSpacing: 3, marginBottom: 8, opacity: 0.7 }}>{TIER_LABELS[tier]}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ABILITIES.filter(a => a.tier === tier).map(a => (
                  <div key={a.id} style={{ width: 90, padding: "8px 4px 6px", background: T.bg.card, border: `1px solid ${T.border.subtle}`, borderRadius: 8, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <Icon name={a.id} color={a.color} size={34} glow />
                    <div style={{ fontSize: 6.5, color: "#ffffffaa", letterSpacing: 0.5, lineHeight: 1.2 }}>{a.name}</div>
                    <div style={{ fontSize: 6.5, color: a.color, opacity: 0.6, fontFamily: "monospace" }}>★{a.cost}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- CONTROLS ---- */}
      {view === "controls" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", gap: 16 }}>
            {[{ id: "left", label: "LEFT" }, { id: "down", label: "DOWN" }, { id: "drop", label: "DROP" }, { id: "rotate", label: "ROTATE" }, { id: "right", label: "RIGHT" }].map(b => (
              <div key={b.id} style={{ textAlign: "center" }}>
                <div style={{ width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", background: T.bg.card, border: `1px solid ${T.border.medium}`, borderRadius: 12 }}>
                  <Icon type="control" name={b.id} color="#ffffff99" size={40} />
                </div>
                <div style={{ fontSize: 7, color: T.text.tertiary, letterSpacing: 2, marginTop: 6 }}>{b.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 8, color: "#ffffff22", letterSpacing: 3 }}>IN-GAME · TAP TO TEST</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["left", "down", "drop", "rotate", "right"].map(id => (
              <ControlButton key={id} icon={id} wide={id === "drop"} pressed={pressedCtrl === id} onPress={() => { setPressedCtrl(id); setTimeout(() => setPressedCtrl(null), 150); }} />
            ))}
          </div>
        </div>
      )}

      {/* ---- SKILL BAR ---- */}
      {view === "skill-bar" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 8, color: "#ffffff22", letterSpacing: 3 }}>IN-GAME SKILL BAR · GHOST STYLE</div>
          <div style={{ background: "rgba(5,5,22,0.9)", borderRadius: 12, padding: "8px 4px", display: "flex", justifyContent: "center" }}>
            {ABILITIES.slice(0, 6).map((a, i) => (
              <SkillButton key={a.id} icon={a.id} cost={a.cost} color={a.color} active={activeSkill === i} canAfford={true} onClick={() => setActiveSkill(activeSkill === i ? null : i)} />
            ))}
          </div>
          <div style={{ fontSize: 8, color: "#ffffff22" }}>click a skill to activate</div>
          <div style={{ fontSize: 8, color: "#ffffff22", letterSpacing: 3, marginTop: 12 }}>FULL CONTROL BAR</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["left", "down", "drop", "rotate", "right"].map(id => (
              <ControlButton key={id} icon={id} wide={id === "drop"} pressed={pressedCtrl === id} onPress={() => { setPressedCtrl(id); setTimeout(() => setPressedCtrl(null), 150); }} />
            ))}
          </div>
        </div>
      )}

      {/* ---- ABILITIES SCREEN ---- */}
      {view === "abilities" && (
        <Panel title="ABILITIES" onClose={() => {}}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 10, color: T.text.secondary }}>Loadout (1/6)</span>
            <CoinsBadge amount={184040} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {ABILITIES.slice(0, 9).map((a, i) => (
              <AbilityCard key={a.id} icon={a.id} name={a.name} cost={a.cost} desc={a.desc} color={a.color} equipped={equipped.has(i)} onClick={() => { const n = new Set(equipped); n.has(i) ? n.delete(i) : n.add(i); setEquipped(n); }} />
            ))}
          </div>
        </Panel>
      )}

      {/* ---- FRIENDS ---- */}
      {view === "friends" && (
        <Panel title="FRIENDS" onClose={() => {}}>
          <Tabs tabs={["FRIENDS", "REQUESTS", "ADD FRIEND"]} active={friendTab} onChange={setFriendTab} />
          {friendTab === "ADD FRIEND" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><Label>Add by username</Label><Input placeholder="Enter username..." button="SEND" /></div>
              <div><Label>Search players</Label><Input placeholder="Search by username..." /></div>
            </div>
          )}
          {friendTab === "FRIENDS" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {["cyberstacker", "blockmaster", "tetrix_pro"].map(name => (
                <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: T.bg.card, borderRadius: T.radius.md }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent.green, boxShadow: `0 0 6px ${T.accent.green}88` }} />
                    <span style={{ fontSize: 11, color: T.text.primary, fontFamily: T.font.mono }}>{name}</span>
                  </div>
                  <button style={{ background: T.bg.button, border: `1px solid ${T.accent.cyan}33`, borderRadius: T.radius.sm, color: T.accent.cyan, fontFamily: T.font.display, fontSize: 8, fontWeight: 700, padding: "5px 12px", cursor: "pointer", letterSpacing: 2 }}>CHALLENGE</button>
                </div>
              ))}
            </div>
          )}
          {friendTab === "REQUESTS" && <div style={{ fontSize: 11, color: T.text.tertiary, textAlign: "center", padding: 20 }}>No pending requests</div>}
        </Panel>
      )}

      {/* ---- PROFILE ---- */}
      {view === "profile" && (
        <Panel title="laptop" onClose={() => {}}>
          <div style={{ display: "flex", gap: 4, marginBottom: 20, padding: "8px 0" }}>
            <StatBadge value="184k" label="COINS" color={T.accent.yellow} />
            <StatBadge value="10" label="GAMES" color={T.accent.cyan} />
            <StatBadge value="5-5" label="W/L" color={T.accent.green} />
            <StatBadge value="1" label="STREAK" color={T.accent.pink} />
            <StatBadge value="50%" label="WIN RATE" color={T.accent.purple} />
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.accent.cyan, letterSpacing: 3, marginBottom: 10, fontFamily: T.font.display }}>RECENT MATCHES</div>
          <MatchRow result="WIN" opponent="laptopss" date="2/19/2026" coins={100} />
          <MatchRow result="LOSS" opponent="laptopss" date="2/19/2026" coins={30} />
          <MatchRow result="WIN" opponent="safari" date="2/19/2026" coins={100} />
          <MatchRow result="WIN" opponent="Unknown" date="2/19/2026" coins={40} />
          <MatchRow result="LOSS" opponent="Unknown" date="2/19/2026" coins={10} />
        </Panel>
      )}

      {/* ---- VICTORY / DEFEAT ---- */}
      {view === "victory" && <Panel title="">{<ResultScreen victory={true} />}</Panel>}
      {view === "defeat" && <Panel title="">{<ResultScreen victory={false} />}</Panel>}
    </div>
  );
}

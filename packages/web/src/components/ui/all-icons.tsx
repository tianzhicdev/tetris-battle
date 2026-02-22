// ============================================================
// ALL ICONS — 32 Ability Icons + 5 Control Icons (SVG)
// Extracted from: /docs/stackcraft-design-system.jsx
// ============================================================

import type { JSX } from 'react';

export const abilityIcons: Record<string, (c: string, s: number) => JSX.Element> = {
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
  speed_up_opponent: (c = "#fff", s = 32) => (
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
  deflect_shield: (c = "#fff", s = 32) => (
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
  piece_preview_plus: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="4" y="4" width="24" height="24" rx="2" stroke={c} strokeWidth="1.2" opacity="0.3" />
      <rect x="10" y="8" width="4" height="4" rx="0.5" fill={c} opacity="0.15" />
      <rect x="14" y="8" width="4" height="4" rx="0.5" fill={c} opacity="0.15" />
      <rect x="18" y="8" width="4" height="4" rx="0.5" fill={c} opacity="0.15" />
      <rect x="10" y="12" width="4" height="4" rx="0.5" fill={c} opacity="0.15" />
      <rect x="10" y="16" width="4" height="4" rx="0.5" fill={c} opacity="0.15" />
      <rect x="10" y="20" width="4" height="4" rx="0.5" fill={c} opacity="0.15" />
      <path d="M25 15L25 11M23 13L27 13" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
      <text x="21" y="24" fontFamily="system-ui" fontSize="6" fontWeight="800" fill={c} opacity="0.5">+2</text>
    </svg>
  ),
  row_rotate: (c = "#fff", s = 32) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="3" y="13" width="26" height="6" rx="1" fill={c} opacity="0.35" />
      <rect x="5" y="14" width="4" height="4" rx="0.5" fill={c} opacity="0.2" />
      <rect x="10" y="14" width="4" height="4" rx="0.5" fill={c} opacity="0.2" />
      <rect x="15" y="14" width="4" height="4" rx="0.5" fill={c} opacity="0.2" />
      <path d="M22 16A4 4 0 0 1 28 16" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M26.5 14L28 16L26.5 18" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      <rect x="3" y="5" width="26" height="4" rx="0.5" fill={c} opacity="0.15" />
      <rect x="3" y="23" width="26" height="4" rx="0.5" fill={c} opacity="0.15" />
    </svg>
  ),
};

// Add alias for shield (abilities.json uses "shield" but design system uses "deflect_shield")
abilityIcons.shield = abilityIcons.deflect_shield;
abilityIcons.cylinder_vision = abilityIcons.blind_spot;

export const controlIcons: Record<string, (c: string, s: number) => JSX.Element> = {
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

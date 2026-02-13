// Progression system types and constants

export interface UserProfile {
  userId: string; // Clerk user ID
  username: string;
  level: number;
  xp: number;
  coins: number;
  elo: number;
  unlockedAbilities: string[]; // ability IDs
  loadout: string[]; // ability IDs (max 3-6 based on level)
  createdAt: number;
  updatedAt: number;
}

export interface MatchResult {
  id: string;
  userId: string;
  opponentId: string;
  outcome: 'win' | 'loss' | 'draw';
  linesCleared: number;
  abilitiesUsed: number;
  coinsEarned: number;
  xpEarned: number;
  duration: number; // seconds
  timestamp: number;
}

export interface DailyQuest {
  id: string;
  type: 'clear_lines' | 'win_matches' | 'use_abilities' | 'perfect_clear' | 't_spin' | 'buff_only_win';
  title: string;
  description: string;
  target: number; // e.g., 50 lines, 3 wins
  progress: number;
  reward: number; // coins
  expiresAt: number; // midnight timestamp
}

export interface WeeklyChallenge {
  id: string;
  type: 'win_matches' | 'clear_lines' | 'reach_rank';
  title: string;
  description: string;
  target: number;
  progress: number;
  reward: number; // coins
  expiresAt: number; // end of week timestamp
}

export interface UserQuests {
  userId: string;
  daily: DailyQuest[];
  weekly: WeeklyChallenge | null;
  lastRefresh: number;
}

// Constants from progression system doc

export const COIN_VALUES = {
  win: 50,
  loss: 20,
  draw: 10,
  // Performance bonuses
  lines20Plus: 10,
  lines40Plus: 25,
  abilities5Plus: 10,
  noAbilityWin: 30,
  // Streaks
  streak3: 15,
  streak5: 30,
  streak10: 60,
  firstWinOfDay: 25,
} as const;

export const XP_VALUES = {
  matchComplete: 100,
  matchWin: 50,
  dailyQuest: 75,
  weeklyChallenge: 300,
} as const;

export const LEVEL_THRESHOLDS = [
  // Levels 1-5 (Rookie)
  { level: 1, xpRequired: 0 },
  { level: 2, xpRequired: 300 },
  { level: 3, xpRequired: 600 },
  { level: 4, xpRequired: 900 },
  { level: 5, xpRequired: 1200 },
  // Levels 6-10 (Contender)
  { level: 6, xpRequired: 1700 },
  { level: 7, xpRequired: 2200 },
  { level: 8, xpRequired: 2700 },
  { level: 9, xpRequired: 3200 },
  { level: 10, xpRequired: 3700 },
  // Levels 11-15 (Challenger)
  { level: 11, xpRequired: 4450 },
  { level: 12, xpRequired: 5200 },
  { level: 13, xpRequired: 5950 },
  { level: 14, xpRequired: 6700 },
  { level: 15, xpRequired: 7450 },
  // Levels 16-20 (Veteran)
  { level: 16, xpRequired: 8450 },
  { level: 17, xpRequired: 9450 },
  { level: 18, xpRequired: 10450 },
  { level: 19, xpRequired: 11450 },
  { level: 20, xpRequired: 12450 },
  // Levels 21-25 (Master)
  { level: 21, xpRequired: 13950 },
  { level: 22, xpRequired: 15450 },
  { level: 23, xpRequired: 16950 },
  { level: 24, xpRequired: 18450 },
  { level: 25, xpRequired: 19950 },
  // Levels 26-30 (Legend)
  { level: 26, xpRequired: 21950 },
  { level: 27, xpRequired: 23950 },
  { level: 28, xpRequired: 25950 },
  { level: 29, xpRequired: 27950 },
  { level: 30, xpRequired: 29950 },
] as const;

export type Stage = 'rookie' | 'contender' | 'challenger' | 'veteran' | 'master' | 'legend';

export function getLevelStage(level: number): Stage {
  if (level >= 26) return 'legend';
  if (level >= 21) return 'master';
  if (level >= 16) return 'veteran';
  if (level >= 11) return 'challenger';
  if (level >= 6) return 'contender';
  return 'rookie';
}

export function getLoadoutSlots(level: number): number {
  if (level >= 22) return 6;
  if (level >= 12) return 5;
  if (level >= 6) return 4;
  return 3;
}

export function getXpForNextLevel(currentLevel: number): number {
  const nextLevelData = LEVEL_THRESHOLDS.find(l => l.level === currentLevel + 1);
  if (!nextLevelData) return 0; // Max level

  const currentLevelData = LEVEL_THRESHOLDS.find(l => l.level === currentLevel);
  return nextLevelData.xpRequired - (currentLevelData?.xpRequired || 0);
}

export function calculateLevel(xp: number): number {
  let level = 1;
  for (const threshold of LEVEL_THRESHOLDS) {
    if (xp >= threshold.xpRequired) {
      level = threshold.level;
    } else {
      break;
    }
  }
  return level;
}

// Starter abilities (free at level 1)
export const STARTER_ABILITIES = [
  'screen_shake',
  'speed_up_opponent',
  'mini_blocks',
] as const;

// Ability unlock mapping
export interface AbilityUnlock {
  abilityId: string;
  level: number;
  cost: number;
}

// Config-driven ability unlocks - organized by progression tier
// This makes it easy to add, remove, or reorganize abilities
export const ABILITY_UNLOCKS: AbilityUnlock[] = [
  // === ROOKIE TIER (Level 1-5) ===
  // Free starter abilities - balanced mix of simple debuffs and one buff
  { abilityId: 'screen_shake', level: 1, cost: 0 },      // Debuff: Visual distraction
  { abilityId: 'speed_up_opponent', level: 1, cost: 0 }, // Debuff: Increases piece speed
  { abilityId: 'mini_blocks', level: 1, cost: 0 },       // Buff: Makes your pieces smaller

  // Early purchasable abilities - low-cost debuffs
  { abilityId: 'reverse_controls', level: 1, cost: 150 }, // Debuff: Swap left/right
  { abilityId: 'blind_spot', level: 3, cost: 200 },       // Debuff: Hide bottom rows

  // === CONTENDER TIER (Level 6-10) ===
  // Introduce offensive buffs and stronger debuffs
  { abilityId: 'cross_firebomb', level: 6, cost: 300 },  // Buff: Cross explosion
  { abilityId: 'circle_bomb', level: 6, cost: 350 },     // Buff: Radial explosion
  { abilityId: 'rotation_lock', level: 7, cost: 400 },   // Debuff: Disable rotation
  { abilityId: 'shrink_ceiling', level: 8, cost: 350 },  // Debuff: Reduce play area

  // === CHALLENGER TIER (Level 11-15) ===
  // Powerful clearing and disruption abilities
  { abilityId: 'clear_rows', level: 11, cost: 500 },     // Buff: Clear 5 bottom rows
  { abilityId: 'random_spawner', level: 12, cost: 450 }, // Debuff: Spawn garbage blocks
  { abilityId: 'earthquake', level: 13, cost: 550 },     // Debuff: Shift all rows

  // === VETERAN TIER (Level 16-20) ===
  // Advanced strategic abilities
  { abilityId: 'cascade_multiplier', level: 16, cost: 800 }, // Buff: Double star earnings
  { abilityId: 'weird_shapes', level: 17, cost: 700 },       // Debuff: Large random pieces
];

// Ability unlock distribution by tier (for balance checking)
export const UNLOCK_DISTRIBUTION = {
  rookie: { levels: '1-5', buffs: 1, debuffs: 4, total: 5 },
  contender: { levels: '6-10', buffs: 2, debuffs: 2, total: 4 },
  challenger: { levels: '11-15', buffs: 1, debuffs: 2, total: 3 },
  veteran: { levels: '16-20', buffs: 1, debuffs: 1, total: 2 },
} as const;

export function getAvailableAbilities(level: number): AbilityUnlock[] {
  return ABILITY_UNLOCKS.filter(unlock => unlock.level <= level);
}

export function getAbilityUnlockCost(abilityId: string): number {
  const unlock = ABILITY_UNLOCKS.find(u => u.abilityId === abilityId);
  return unlock?.cost || 0;
}

export function canUnlockAbility(abilityId: string, level: number, coins: number, unlockedAbilities: string[]): boolean {
  if (unlockedAbilities.includes(abilityId)) return false; // Already unlocked

  const unlock = ABILITY_UNLOCKS.find(u => u.abilityId === abilityId);
  if (!unlock) return false;

  return level >= unlock.level && coins >= unlock.cost;
}

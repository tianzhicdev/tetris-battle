// Progression system types and constants
import abilitiesConfig from './abilities.json';

export interface UserProfile {
  userId: string; // Clerk user ID
  username: string;
  level: number;
  xp: number;
  coins: number;
  rank: number;
  gamesPlayed: number; // Total ranked games played
  lastActiveAt: number; // Timestamp of last game
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
  rankChange: number; // Can be negative
  rankAfter: number;
  opponentRank: number;
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

export function getLoadoutSlots(_level?: number): number {
  // Everyone gets 6 loadout slots from the start
  return 6;
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

// Starter abilities (free at level 1) - loaded from JSON
export const STARTER_ABILITIES = Object.entries(abilitiesConfig.abilities)
  .filter(([_, ability]) => ability.unlockLevel === 1 && ability.unlockCost === 0)
  .map(([id, _]) => id);

// Ability unlock mapping
export interface AbilityUnlock {
  abilityId: string;
  level: number;
  cost: number;
}

// Config-driven ability unlocks - loaded from JSON
export const ABILITY_UNLOCKS: AbilityUnlock[] = Object.entries(abilitiesConfig.abilities)
  .map(([id, ability]) => ({
    abilityId: id,
    level: ability.unlockLevel,
    cost: ability.unlockCost,
  }))
  .sort((a, b) => a.level - b.level || a.cost - b.cost);

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

// ============================================
// RANK RATING SYSTEM
// ============================================

// Rank constants
export const RANK_CONFIG = {
  startingRank: 1000,
  placementGames: 10, // First 10 games are placement matches
  placementKFactor: 50, // High volatility during placement
  normalKFactor: 16, // Standard K-factor after placement
  skillFloor: 800, // Rank below which loss protection applies
  skillFloorProtection: 0.5, // Reduce losses by 50% below skill floor
  activityDecayDays: 14, // Days before decay starts
  activityDecayRate: 5, // Points per day toward mean (1000)
} as const;

/**
 * Calculate expected win probability using Elo formula
 * @param playerRank - Player's current Rank rating
 * @param opponentRank - Opponent's current Rank rating
 * @returns Expected win probability (0 to 1)
 */
export function calculateExpectedScore(playerRank: number, opponentRank: number): number {
  return 1 / (1 + Math.pow(10, (opponentRank - playerRank) / 400));
}

/**
 * Calculate Rank change after a match
 * @param playerRank - Player's current Rank
 * @param opponentRank - Opponent's Rank
 * @param outcome - 'win' (1), 'loss' (0), or 'draw' (0.5)
 * @param gamesPlayed - Total games played by player (for placement detection)
 * @returns Rank change (can be negative)
 */
export function calculateRankChange(
  playerRank: number,
  opponentRank: number,
  outcome: 'win' | 'loss' | 'draw',
  gamesPlayed: number
): number {
  // Determine K-factor based on placement status
  const isPlacement = gamesPlayed < RANK_CONFIG.placementGames;
  let kFactor = isPlacement ? RANK_CONFIG.placementKFactor : RANK_CONFIG.normalKFactor;

  // Calculate expected score
  const expected = calculateExpectedScore(playerRank, opponentRank);

  // Convert outcome to actual score
  const actual = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;

  // Calculate base Rank change
  let rankChange = Math.round(kFactor * (actual - expected));

  // Apply skill floor protection (reduce losses for low-rated players)
  if (playerRank < RANK_CONFIG.skillFloor && rankChange < 0) {
    rankChange = Math.round(rankChange * RANK_CONFIG.skillFloorProtection);
  }

  return rankChange;
}

/**
 * Calculate Rank decay for inactive players
 * @param currentRank - Player's current Rank
 * @param lastActiveAt - Timestamp of last game
 * @returns New Rank after decay
 */
export function calculateRankDecay(currentRank: number, lastActiveAt: number): number {
  const now = Date.now();
  const daysSinceActive = (now - lastActiveAt) / (1000 * 60 * 60 * 24);

  // No decay if active within threshold
  if (daysSinceActive < RANK_CONFIG.activityDecayDays) {
    return currentRank;
  }

  // Calculate days of decay
  const decayDays = Math.floor(daysSinceActive - RANK_CONFIG.activityDecayDays);

  // Drift toward mean (1000) at decay rate per day
  const targetRank = RANK_CONFIG.startingRank;
  const decayAmount = decayDays * RANK_CONFIG.activityDecayRate;

  if (currentRank > targetRank) {
    // Drift down
    return Math.max(targetRank, currentRank - decayAmount);
  } else if (currentRank < targetRank) {
    // Drift up
    return Math.min(targetRank, currentRank + decayAmount);
  }

  return currentRank;
}

/**
 * Get rank tier based on rating
 */
export type RankTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grandmaster';

export function getRankTier(rank: number): RankTier {
  if (rank >= 2000) return 'grandmaster';
  if (rank >= 1600) return 'master';
  if (rank >= 1400) return 'diamond';
  if (rank >= 1200) return 'platinum';
  if (rank >= 1000) return 'gold';
  if (rank >= 800) return 'silver';
  return 'bronze';
}

/**
 * Check if player is in placement matches
 */
export function isInPlacement(gamesPlayed: number): boolean {
  return gamesPlayed < RANK_CONFIG.placementGames;
}

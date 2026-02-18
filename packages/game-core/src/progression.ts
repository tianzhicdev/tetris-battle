// Progression system types and constants
import { ABILITY_LIST } from './abilities';

export interface UserProfile {
  userId: string; // Clerk user ID
  username: string;
  coins: number;
  matchmakingRating: number;
  gamesPlayed: number; // Total games played
  gamesWon: number; // Total games won
  lastActiveAt: number; // Timestamp of last game
  unlockedAbilities: string[]; // ability IDs
  loadout: string[]; // ability IDs (max 6)
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
  // Base rewards
  humanWin: 100,
  humanLoss: 30,
  draw: 10,
  aiEasyWin: 20,
  aiMediumWin: 40,
  aiHardWin: 60,
  aiLoss: 10,
  // Bonuses
  firstWinOfDay: 50,
  streak5: 25,
} as const;

function getUnlockLevel(ability: { unlockLevel?: number; unlockTier?: number }): number {
  if (typeof ability.unlockLevel === 'number') return ability.unlockLevel;
  if (typeof ability.unlockTier === 'number') return ability.unlockTier;
  return 1;
}

// Starter abilities (free, no unlock cost) - loaded from JSON
export const STARTER_ABILITIES = ABILITY_LIST
  .filter((ability) => getUnlockLevel(ability) === 1 && ability.unlockCost === 0)
  .map((ability) => ability.id);

// Ability unlock mapping
export interface AbilityUnlock {
  abilityId: string;
  level: number;
  cost: number;
}

// Config-driven ability unlocks - loaded from JSON
export const ABILITY_UNLOCKS: AbilityUnlock[] = ABILITY_LIST
  .map((ability) => ({
    abilityId: ability.id,
    level: getUnlockLevel(ability),
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

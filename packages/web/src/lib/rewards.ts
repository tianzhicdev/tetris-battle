import { progressionService } from './supabase';
import { COIN_VALUES, XP_VALUES, calculateLevel } from '@tetris-battle/game-core';

export interface MatchRewards {
  coins: number;
  xp: number;
  newLevel: number;
  leveledUp: boolean;
  breakdown: {
    baseCoins: number;
    performanceBonus: number;
    streakBonus: number;
    firstWinBonus: number;
    baseXp: number;
    winBonus: number;
  };
}

export async function awardMatchRewards(
  userId: string,
  outcome: 'win' | 'loss' | 'draw',
  linesCleared: number,
  abilitiesUsed: number,
  matchDuration: number,
  opponentId: string
): Promise<MatchRewards | null> {
  try {
    const profile = await progressionService.getUserProfile(userId);
    if (!profile) return null;

    const oldLevel = profile.level;

    // Calculate base coins
    let baseCoins = COIN_VALUES[outcome];
    let performanceBonus = 0;
    let streakBonus = 0;
    let firstWinBonus = 0;

    // Add performance bonuses
    if (linesCleared >= 40) {
      performanceBonus += COIN_VALUES.lines40Plus;
    } else if (linesCleared >= 20) {
      performanceBonus += COIN_VALUES.lines20Plus;
    }

    if (abilitiesUsed >= 5) {
      performanceBonus += COIN_VALUES.abilities5Plus;
    } else if (abilitiesUsed === 0 && outcome === 'win') {
      performanceBonus += COIN_VALUES.noAbilityWin;
    }

    // Check win streak (only for wins)
    if (outcome === 'win') {
      const streak = await progressionService.getWinStreak(userId);
      if (streak >= 10) {
        streakBonus = COIN_VALUES.streak10;
      } else if (streak >= 5) {
        streakBonus = COIN_VALUES.streak5;
      } else if (streak >= 3) {
        streakBonus = COIN_VALUES.streak3;
      }

      // Check first win of day
      const todayStats = await progressionService.getTodayStats(userId);
      if (todayStats.wins === 0) {
        firstWinBonus = COIN_VALUES.firstWinOfDay;
      }
    }

    const totalCoins = baseCoins + performanceBonus + streakBonus + firstWinBonus;

    // Calculate XP
    let baseXp = XP_VALUES.matchComplete;
    let winBonus = 0;
    if (outcome === 'win') {
      winBonus = XP_VALUES.matchWin;
    }

    const totalXp = baseXp + winBonus;

    // Save match result
    await progressionService.saveMatchResult({
      id: crypto.randomUUID(),
      userId,
      opponentId,
      outcome,
      linesCleared,
      abilitiesUsed,
      coinsEarned: totalCoins,
      xpEarned: totalXp,
      rankChange: 0, // Legacy function, Rank calculated elsewhere
      rankAfter: profile.rank,
      opponentRank: 1000, // Default, not used in legacy function
      duration: matchDuration,
      timestamp: Date.now(),
    });

    // Update user profile
    const newCoins = Math.min(profile.coins + totalCoins, 999999); // Max coins cap
    const newXp = profile.xp + totalXp;
    const newLevel = calculateLevel(newXp);
    const leveledUp = newLevel > oldLevel;

    await progressionService.updateUserProfile(userId, {
      coins: newCoins,
      xp: newXp,
      level: newLevel,
    });

    return {
      coins: totalCoins,
      xp: totalXp,
      newLevel,
      leveledUp,
      breakdown: {
        baseCoins,
        performanceBonus,
        streakBonus,
        firstWinBonus,
        baseXp,
        winBonus,
      },
    };
  } catch (error) {
    console.error('Error awarding match rewards:', error);
    return null;
  }
}

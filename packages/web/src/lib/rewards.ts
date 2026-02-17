import { progressionService } from './supabase';
import { COIN_VALUES, ABILITY_LIST } from '@tetris-battle/game-core';

export interface MatchRewards {
  coins: number;
  newCoins: number;
  breakdown: {
    baseCoins: number;
    firstWinBonus: number;
    streakBonus: number;
  };
  nextUnlock?: {
    abilityId: string;
    abilityName: string;
    coinsNeeded: number;
  };
}

export async function awardMatchRewards(
  userId: string,
  outcome: 'win' | 'loss',
  opponentType: 'human' | 'ai_easy' | 'ai_medium' | 'ai_hard',
  matchDuration: number,
  opponentId: string
): Promise<MatchRewards | null> {
  try {
    const profile = await progressionService.getUserProfile(userId);
    if (!profile) return null;

    // Calculate base coins based on opponent type
    let baseCoins = 0;

    if (outcome === 'win') {
      if (opponentType === 'human') {
        baseCoins = COIN_VALUES.humanWin;
      } else if (opponentType === 'ai_easy') {
        baseCoins = COIN_VALUES.aiEasyWin;
      } else if (opponentType === 'ai_medium') {
        baseCoins = COIN_VALUES.aiMediumWin;
      } else if (opponentType === 'ai_hard') {
        baseCoins = COIN_VALUES.aiHardWin;
      }
    } else {
      // Loss
      if (opponentType === 'human') {
        baseCoins = COIN_VALUES.humanLoss;
      } else {
        baseCoins = COIN_VALUES.aiLoss;
      }
    }

    let firstWinBonus = 0;
    let streakBonus = 0;

    // Check first win of day (only for wins)
    if (outcome === 'win') {
      const todayStats = await progressionService.getTodayStats(userId);
      if (todayStats.wins === 0) {
        firstWinBonus = COIN_VALUES.firstWinOfDay;
      }

      // Check 5-game streak
      const streak = await progressionService.getWinStreak(userId);
      if (streak > 0 && streak % 5 === 0) {
        streakBonus = COIN_VALUES.streak5;
      }
    }

    const totalCoins = baseCoins + firstWinBonus + streakBonus;

    // Save match result
    await progressionService.saveMatchResult({
      id: crypto.randomUUID(),
      userId,
      opponentId,
      outcome,
      linesCleared: 0,  // No longer tracked for rewards
      abilitiesUsed: 0, // No longer tracked for rewards
      coinsEarned: totalCoins,
      rankChange: 0,
      rankAfter: profile.matchmakingRating,
      opponentRank: 1000,
      duration: matchDuration,
      timestamp: Date.now(),
    });

    // Update user profile
    const newCoins = Math.min(profile.coins + totalCoins, 999999);
    const newGamesWon = outcome === 'win' ? profile.gamesWon + 1 : profile.gamesWon;

    await progressionService.updateUserProfile(userId, {
      coins: newCoins,
      gamesWon: newGamesWon,
    });

    // Find next unlock suggestion
    const availableAbilities = ABILITY_LIST
      .filter((ability) => !profile.unlockedAbilities.includes(ability.id))
      .sort((a, b) => a.unlockCost - b.unlockCost);

    const nextUnlock = availableAbilities.length > 0 ? {
      abilityId: availableAbilities[0].id,
      abilityName: availableAbilities[0].name,
      coinsNeeded: Math.max(0, availableAbilities[0].unlockCost - newCoins),
    } : undefined;

    return {
      coins: totalCoins,
      newCoins,
      breakdown: {
        baseCoins,
        firstWinBonus,
        streakBonus,
      },
      nextUnlock,
    };
  } catch (error) {
    console.error('Error awarding match rewards:', error);
    return null;
  }
}

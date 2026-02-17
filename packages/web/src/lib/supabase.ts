import { createClient } from '@supabase/supabase-js';
import type { UserProfile, MatchResult } from '@tetris-battle/game-core';
import { ABILITIES, STARTER_ABILITIES } from '@tetris-battle/game-core';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
});

// ============================================================================
// DB row types (snake_case — matches the schema)
// ============================================================================

interface DbProfile {
  id: string;
  username: string;
  coins: number;
  rating: number;
  games_played: number;
  games_won: number;
  unlocked_abilities: string[];
  loadout: string[];
  last_active_at: string;
  created_at: string;
  updated_at: string;
}

interface DbMatchResult {
  id: string;
  user_id: string;
  opponent_id: string;
  outcome: 'win' | 'loss' | 'draw';
  coins_earned: number;
  duration: number;
  timestamp: number;
  rating_before: number;
  rating_change: number;
  rating_after: number;
  opponent_rating: number;
}

// ============================================================================
// Mapping helpers (DB row → TypeScript interface)
// ============================================================================

const VALID_ABILITY_IDS = new Set(Object.keys(ABILITIES));

function sanitizeAbilityIds(ids: string[] | undefined | null): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id) => VALID_ABILITY_IDS.has(id));
}

function dbToProfile(row: DbProfile): UserProfile {
  return {
    userId: row.id,
    username: row.username,
    coins: row.coins,
    matchmakingRating: row.rating,
    gamesPlayed: row.games_played,
    gamesWon: row.games_won,
    unlockedAbilities: sanitizeAbilityIds(row.unlocked_abilities),
    loadout: sanitizeAbilityIds(row.loadout),
    lastActiveAt: new Date(row.last_active_at).getTime(),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function dbToMatchResult(row: DbMatchResult): MatchResult {
  return {
    id: row.id,
    userId: row.user_id,
    opponentId: row.opponent_id,
    outcome: row.outcome,
    linesCleared: 0,       // deprecated field, kept for interface compat
    abilitiesUsed: 0,      // deprecated field, kept for interface compat
    coinsEarned: row.coins_earned,
    duration: row.duration,
    timestamp: row.timestamp,
    rankChange: row.rating_change,
    rankAfter: row.rating_after,
    opponentRank: row.opponent_rating,
  };
}

// GameRoom type kept for compatibility with matchmaking
export interface GameRoom {
  id: string;
  status: 'waiting' | 'playing' | 'finished';
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

// ============================================================================
// Progression Service
// ============================================================================

export class ProgressionService {
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    const profile = dbToProfile(data as DbProfile);

    // Recover from empty/invalid ability lists
    const originalUnlocked = profile.unlockedAbilities;
    const originalLoadout = profile.loadout;

    let unlockedAbilities = sanitizeAbilityIds(originalUnlocked);
    let loadout = sanitizeAbilityIds(originalLoadout);

    // Keep loadout constrained to unlocked abilities
    const unlockedSet = new Set(unlockedAbilities);
    loadout = loadout.filter((id) => unlockedSet.has(id));

    if (unlockedAbilities.length === 0) unlockedAbilities.push(...STARTER_ABILITIES);
    if (loadout.length === 0)
      loadout = STARTER_ABILITIES.filter((id) => unlockedAbilities.includes(id));

    const needsUpdate =
      JSON.stringify(originalUnlocked) !== JSON.stringify(unlockedAbilities) ||
      JSON.stringify(originalLoadout) !== JSON.stringify(loadout);

    profile.unlockedAbilities = unlockedAbilities;
    profile.loadout = loadout;

    if (needsUpdate) {
      console.log('[SUPABASE] Sanitizing ability lists');
      await this.updateUserProfile(userId, {
        unlockedAbilities,
        loadout,
      });
    }

    return profile;
  }

  async createUserProfile(userId: string, username: string): Promise<UserProfile | null> {
    const starterAbilities = [...STARTER_ABILITIES] as string[];

    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        username,
        coins: 0,
        rating: 1000,
        games_played: 0,
        games_won: 0,
        unlocked_abilities: starterAbilities,
        loadout: starterAbilities,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user profile:', error);
      return null;
    }

    return dbToProfile(data as DbProfile);
  }

  async updateUserProfile(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<UserProfile | null> {
    // Map camelCase UserProfile fields → snake_case DB columns
    const dbUpdates: Partial<Record<string, unknown>> = {};
    if (updates.coins !== undefined)              dbUpdates.coins              = updates.coins;
    if (updates.matchmakingRating !== undefined)  dbUpdates.rating             = updates.matchmakingRating;
    if (updates.gamesPlayed !== undefined)        dbUpdates.games_played       = updates.gamesPlayed;
    if (updates.gamesWon !== undefined)           dbUpdates.games_won          = updates.gamesWon;
    if (updates.unlockedAbilities !== undefined)  dbUpdates.unlocked_abilities = updates.unlockedAbilities;
    if (updates.loadout !== undefined)            dbUpdates.loadout            = updates.loadout;
    if (updates.lastActiveAt !== undefined)       dbUpdates.last_active_at     = new Date(updates.lastActiveAt).toISOString();
    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('user_profiles')
      .update(dbUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      return null;
    }

    return dbToProfile(data as DbProfile);
  }

  async unlockAbility(
    userId: string,
    abilityId: string,
    cost: number
  ): Promise<UserProfile | null> {
    if (!VALID_ABILITY_IDS.has(abilityId)) {
      console.error('Cannot unlock unknown/removed ability:', abilityId);
      return null;
    }

    const profile = await this.getUserProfile(userId);
    if (!profile) return null;

    if (profile.unlockedAbilities.includes(abilityId)) return profile;
    if (profile.coins < cost) {
      console.error('Not enough coins to unlock ability');
      return null;
    }

    return await this.updateUserProfile(userId, {
      unlockedAbilities: [...profile.unlockedAbilities, abilityId],
      coins: profile.coins - cost,
    });
  }

  async updateLoadout(userId: string, loadout: string[]): Promise<boolean> {
    const sanitizedLoadout = sanitizeAbilityIds(loadout);

    const { error } = await supabase
      .from('user_profiles')
      .update({ loadout: sanitizedLoadout, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('Error updating loadout:', error);
      return false;
    }

    return true;
  }

  async saveMatchResult(result: MatchResult): Promise<boolean> {
    const { error } = await supabase.from('match_results').insert({
      id: result.id,
      user_id: result.userId,
      opponent_id: result.opponentId,
      outcome: result.outcome,
      coins_earned: result.coinsEarned,
      duration: result.duration,
      timestamp: result.timestamp,
      rating_before: result.rankAfter - result.rankChange,
      rating_change: result.rankChange,
      rating_after: result.rankAfter,
      opponent_rating: result.opponentRank,
    });

    if (error) {
      console.error('Error saving match result:', error);
      return false;
    }

    return true;
  }

  async getMatchHistory(userId: string, limit: number = 10): Promise<MatchResult[]> {
    const { data, error } = await supabase
      .from('match_results')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching match history:', error);
      return [];
    }

    return (data as DbMatchResult[]).map(dbToMatchResult);
  }

  async getWinStreak(userId: string): Promise<number> {
    const matches = await this.getMatchHistory(userId, 100);
    let streak = 0;
    for (const match of matches) {
      if (match.outcome === 'win') streak++;
      else break;
    }
    return streak;
  }

  async getTodayStats(userId: string): Promise<{ wins: number; matches: number }> {
    const todayStart = new Date().setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('match_results')
      .select('outcome')
      .eq('user_id', userId)
      .gte('timestamp', todayStart);

    if (error) {
      console.error('Error fetching today stats:', error);
      return { wins: 0, matches: 0 };
    }

    const wins = (data as { outcome: string }[]).filter((m) => m.outcome === 'win').length;
    return { wins, matches: data.length };
  }

  async getLeaderboard(limit: number = 50): Promise<
    Array<{ userId: string; username: string; rating: number; wins: number; losses: number }>
  > {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, rating, games_won, games_played')
      .order('rating', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }

    return (data as DbProfile[]).map((row) => ({
      userId: row.id,
      username: row.username,
      rating: row.rating,
      wins: row.games_won,
      losses: row.games_played - row.games_won,
    }));
  }
}

export const progressionService = new ProgressionService();

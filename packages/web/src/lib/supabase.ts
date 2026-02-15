import { createClient } from '@supabase/supabase-js';
import type { UserProfile, MatchResult } from '@tetris-battle/game-core';
import { ABILITIES, STARTER_ABILITIES } from '@tetris-battle/game-core';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

const VALID_ABILITY_IDS = new Set(Object.keys(ABILITIES));

function sanitizeAbilityIds(ids: string[] | undefined | null): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter(id => VALID_ABILITY_IDS.has(id));
}

// Database types
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

export interface GameState {
  id: string;
  room_id: string;
  player_id: string;
  board: any;
  score: number;
  stars: number;
  lines_cleared: number;
  combo_count: number;
  is_game_over: boolean;
  updated_at: string;
}

export interface GameEvent {
  id: string;
  room_id: string;
  player_id: string;
  event_type: 'move' | 'rotate' | 'drop' | 'ability' | 'piece_locked' | 'lines_cleared';
  event_data: any;
  created_at: string;
}

export interface AbilityActivation {
  id: string;
  room_id: string;
  player_id: string;
  target_player_id: string;
  ability_type: string;
  activated_at: string;
}

// Progression Service
export class ProgressionService {
  // User Profile Methods
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('userId', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    const profile = data as UserProfile;
    const originalUnlocked = Array.isArray(profile.unlockedAbilities) ? profile.unlockedAbilities : [];
    const originalLoadout = Array.isArray(profile.loadout) ? profile.loadout : [];

    const unlockedAbilities = sanitizeAbilityIds(originalUnlocked);
    let loadout = sanitizeAbilityIds(originalLoadout);

    // Keep loadout constrained to currently unlocked abilities.
    const unlockedSet = new Set(unlockedAbilities);
    loadout = loadout.filter(id => unlockedSet.has(id));

    // If unlocks or loadout were emptied by removed abilities, recover with starters.
    if (unlockedAbilities.length === 0) {
      unlockedAbilities.push(...STARTER_ABILITIES);
    }
    if (loadout.length === 0) {
      loadout = STARTER_ABILITIES.filter(id => unlockedAbilities.includes(id));
    }

    const profileNeedsSanitization =
      JSON.stringify(originalUnlocked) !== JSON.stringify(unlockedAbilities) ||
      JSON.stringify(originalLoadout) !== JSON.stringify(loadout);

    profile.unlockedAbilities = unlockedAbilities;
    profile.loadout = loadout;

    // Fix for existing users: if loadout is empty/missing, set it to starter abilities
    if (!profile.loadout || profile.loadout.length === 0) {
      console.log('[SUPABASE] Profile has empty loadout, setting to starter abilities');
      const starterAbilities = [...STARTER_ABILITIES];
      profile.loadout = starterAbilities;
      profile.unlockedAbilities = starterAbilities;

      // Update the profile in database
      await this.updateUserProfile(userId, {
        loadout: starterAbilities,
        unlockedAbilities: starterAbilities,
      });
    } else if (profileNeedsSanitization) {
      console.log('[SUPABASE] Profile ability lists contained invalid/removed entries, sanitizing');
      await this.updateUserProfile(userId, {
        loadout: profile.loadout,
        unlockedAbilities: profile.unlockedAbilities,
      });
    }

    return profile;
  }

  async createUserProfile(userId: string, username: string): Promise<UserProfile | null> {
    const now = Date.now();
    const starterAbilities = [...STARTER_ABILITIES] as string[];

    const profile: UserProfile = {
      userId,
      username,
      coins: 0,
      matchmakingRating: 1000,
      gamesPlayed: 0,
      gamesWon: 0,
      lastActiveAt: now,
      unlockedAbilities: starterAbilities,
      loadout: starterAbilities, // All 4 starter abilities in loadout by default
      createdAt: now,
      updatedAt: now,
    };

    const { data, error } = await supabase
      .from('user_profiles')
      .insert(profile)
      .select()
      .single();

    if (error) {
      console.error('Error creating user profile:', error);
      return null;
    }

    return data as UserProfile;
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ ...updates, updatedAt: Date.now() })
      .eq('userId', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      return null;
    }

    return data as UserProfile;
  }

  async unlockAbility(userId: string, abilityId: string, cost: number): Promise<UserProfile | null> {
    if (!VALID_ABILITY_IDS.has(abilityId)) {
      console.error('Cannot unlock unknown/removed ability:', abilityId);
      return null;
    }

    const profile = await this.getUserProfile(userId);
    if (!profile) return null;

    if (profile.unlockedAbilities.includes(abilityId)) {
      return profile;
    }

    if (profile.coins < cost) {
      console.error('Not enough coins to unlock ability');
      return null;
    }

    const newAbilities = [...profile.unlockedAbilities, abilityId];
    const newCoins = profile.coins - cost;

    return await this.updateUserProfile(userId, {
      unlockedAbilities: newAbilities,
      coins: newCoins,
    });
  }

  async updateLoadout(userId: string, loadout: string[]): Promise<boolean> {
    const sanitizedLoadout = sanitizeAbilityIds(loadout);

    const { error } = await supabase
      .from('user_profiles')
      .update({ loadout: sanitizedLoadout, updatedAt: Date.now() })
      .eq('userId', userId);

    if (error) {
      console.error('Error updating loadout:', error);
      return false;
    }

    return true;
  }

  // Match Result Methods
  async saveMatchResult(result: MatchResult): Promise<boolean> {
    

    const { error} = await supabase
      .from('match_results')
      .insert(result);

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
      .eq('userId', userId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching match history:', error);
      return [];
    }

    return data as MatchResult[];
  }

  async getWinStreak(userId: string): Promise<number> {
    const matches = await this.getMatchHistory(userId, 100);

    let streak = 0;
    for (const match of matches) {
      if (match.outcome === 'win') {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  async getTodayStats(userId: string): Promise<{ wins: number; matches: number }> {
    const todayStart = new Date().setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('match_results')
      .select('outcome')
      .eq('userId', userId)
      .gte('timestamp', todayStart);

    if (error) {
      console.error('Error fetching today stats:', error);
      return { wins: 0, matches: 0 };
    }

    const wins = data.filter(m => m.outcome === 'win').length;
    return { wins, matches: data.length };
  }
}

export const progressionService = new ProgressionService();

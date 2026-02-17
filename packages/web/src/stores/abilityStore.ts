import { create } from 'zustand';
import type { Ability } from '@tetris-battle/game-core';
import { ABILITY_IDS, ABILITY_LIST, getAbilityById, getRandomAbilities } from '@tetris-battle/game-core';

interface AbilityState {
  availableAbilities: Ability[];
  lastRefreshTime: number;
  isTestMode: boolean;
  loadout: string[]; // Player's selected abilities

  // Actions
  setLoadout: (loadout: string[]) => void;
  refreshAbilities: () => void;
  canActivate: (abilityId: string, currentStars: number) => boolean;
  useAbility: (abilityId: string) => void;
}

const REFRESH_INTERVAL = 10000; // 10 seconds

// Check for test mode
const urlParams = new URLSearchParams(window.location.search);
const isTestMode = urlParams.get('testMode') === 'true';

// Get initial abilities - all abilities in test mode, random 3 otherwise
const getInitialAbilities = (): Ability[] => {
  if (isTestMode) {
    return ABILITY_LIST;
  }
  return getRandomAbilities(3);
};

const VALID_ABILITY_IDS = new Set<string>(ABILITY_IDS);

export const useAbilityStore = create<AbilityState>((set, get) => ({
  availableAbilities: getInitialAbilities(),
  lastRefreshTime: Date.now(),
  isTestMode,
  loadout: [],

  setLoadout: (loadout: string[]) => {
    const sanitizedLoadout = (loadout || []).filter(id => VALID_ABILITY_IDS.has(id));
    console.log('[ABILITY STORE] Setting loadout:', sanitizedLoadout);

    // Safety check: if loadout is empty or invalid, don't update
    if (!sanitizedLoadout || sanitizedLoadout.length === 0) {
      console.warn('[ABILITY STORE] Empty loadout received, ignoring');
      return;
    }

    // Get abilities from loadout
    const abilities = sanitizedLoadout
      .map((id) => getAbilityById(id))
      .filter(Boolean) as Ability[];

    console.log('[ABILITY STORE] Loadout abilities:', abilities);

    set({
      loadout: sanitizedLoadout,
      availableAbilities: abilities.length > 0 ? abilities : getRandomAbilities(3),
    });
  },

  refreshAbilities: () => {
    // Don't refresh if we have a loadout set or in test mode
    const { loadout } = get();
    if (isTestMode || loadout.length > 0) return;

    const now = Date.now();
    const { lastRefreshTime } = get();

    if (now - lastRefreshTime >= REFRESH_INTERVAL) {
      set({
        availableAbilities: getRandomAbilities(3),
        lastRefreshTime: now,
      });
    }
  },

  canActivate: (abilityId: string, currentStars: number) => {
    const ability = getAbilityById(abilityId);
    if (!ability) return false;

    // Only check star cost (no cooldowns)
    return currentStars >= ability.cost;
  },

  useAbility: (_abilityId: string) => {
    // No cooldowns to track
  },
}));

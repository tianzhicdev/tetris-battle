import { create } from 'zustand';
import type { Ability } from '@tetris-battle/game-core';
import { ABILITIES, getRandomAbilities } from '@tetris-battle/game-core';

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
    return Object.values(ABILITIES);
  }
  return getRandomAbilities(3);
};

export const useAbilityStore = create<AbilityState>((set, get) => ({
  availableAbilities: getInitialAbilities(),
  lastRefreshTime: Date.now(),
  isTestMode,
  loadout: [],

  setLoadout: (loadout: string[]) => {
    console.log('[ABILITY STORE] Setting loadout:', loadout);

    // Safety check: if loadout is empty or invalid, don't update
    if (!loadout || loadout.length === 0) {
      console.warn('[ABILITY STORE] Empty loadout received, ignoring');
      return;
    }

    // Get abilities from loadout
    const abilities = loadout
      .map(id => ABILITIES[id as keyof typeof ABILITIES])
      .filter(Boolean) as Ability[];

    console.log('[ABILITY STORE] Loadout abilities:', abilities);

    set({
      loadout,
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
    const ability = ABILITIES[abilityId as keyof typeof ABILITIES];
    if (!ability) return false;

    // Only check star cost (no cooldowns)
    return currentStars >= ability.cost;
  },

  useAbility: (_abilityId: string) => {
    // No cooldowns to track
  },
}));

import { create } from 'zustand';
import type { Ability } from '@tetris-battle/game-core';
import { ABILITIES, getRandomAbilities, canActivateAbility } from '@tetris-battle/game-core';

interface AbilityState {
  availableAbilities: Ability[];
  lastAbilityUse: Map<string, number>;
  lastRefreshTime: number;
  isTestMode: boolean;

  // Actions
  refreshAbilities: () => void;
  canActivate: (abilityId: string, currentStars: number) => boolean;
  useAbility: (abilityId: string) => void;
  getCooldownRemaining: (abilityId: string) => number;
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
  lastAbilityUse: new Map(),
  lastRefreshTime: Date.now(),
  isTestMode,

  refreshAbilities: () => {
    // Don't refresh in test mode - all abilities always available
    if (isTestMode) return;

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

    // In test mode, ignore cooldowns - only check star cost
    if (isTestMode) {
      return currentStars >= ability.cost;
    }

    const { lastAbilityUse } = get();
    const lastUse = lastAbilityUse.get(abilityId);

    return canActivateAbility(ability, currentStars, lastUse, Date.now());
  },

  useAbility: (abilityId: string) => {
    // In test mode, don't track usage times (no cooldowns)
    if (isTestMode) return;

    const { lastAbilityUse } = get();
    const newMap = new Map(lastAbilityUse);
    newMap.set(abilityId, Date.now());

    set({ lastAbilityUse: newMap });
  },

  getCooldownRemaining: (abilityId: string) => {
    // No cooldowns in test mode
    if (isTestMode) return 0;

    const ability = ABILITIES[abilityId as keyof typeof ABILITIES];
    if (!ability) return 0;

    const { lastAbilityUse } = get();
    const lastUse = lastAbilityUse.get(abilityId);

    if (!lastUse) return 0;

    const elapsed = Date.now() - lastUse;
    return Math.max(0, ability.cooldown - elapsed);
  },
}));

import { create } from 'zustand';
import type { Ability } from '@tetris-battle/game-core';
import { ABILITIES, getRandomAbilities, canActivateAbility } from '@tetris-battle/game-core';

interface AbilityState {
  availableAbilities: Ability[];
  lastAbilityUse: Map<string, number>;
  lastRefreshTime: number;

  // Actions
  refreshAbilities: () => void;
  canActivate: (abilityId: string, currentStars: number) => boolean;
  useAbility: (abilityId: string) => void;
  getCooldownRemaining: (abilityId: string) => number;
}

const REFRESH_INTERVAL = 10000; // 10 seconds

export const useAbilityStore = create<AbilityState>((set, get) => ({
  availableAbilities: getRandomAbilities(3),
  lastAbilityUse: new Map(),
  lastRefreshTime: Date.now(),

  refreshAbilities: () => {
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

    const { lastAbilityUse } = get();
    const lastUse = lastAbilityUse.get(abilityId);

    return canActivateAbility(ability, currentStars, lastUse, Date.now());
  },

  useAbility: (abilityId: string) => {
    const { lastAbilityUse } = get();
    const newMap = new Map(lastAbilityUse);
    newMap.set(abilityId, Date.now());

    set({ lastAbilityUse: newMap });
  },

  getCooldownRemaining: (abilityId: string) => {
    const ability = ABILITIES[abilityId as keyof typeof ABILITIES];
    if (!ability) return 0;

    const { lastAbilityUse } = get();
    const lastUse = lastAbilityUse.get(abilityId);

    if (!lastUse) return 0;

    const elapsed = Date.now() - lastUse;
    return Math.max(0, ability.cooldown - elapsed);
  },
}));

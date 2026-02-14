import type { Ability, AbilityType } from './types';
import abilitiesConfig from './abilities.json';

// Load abilities from JSON config
const loadAbilities = (): Record<AbilityType, Ability> => {
  const abilities: Record<string, Ability> = {};
  const costFactor = abilitiesConfig.costFactor;

  for (const [key, abilityData] of Object.entries(abilitiesConfig.abilities)) {
    abilities[key] = {
      ...abilityData,
      cost: abilityData.cost * costFactor,
    } as Ability;
  }

  return abilities as Record<AbilityType, Ability>;
};

export const ABILITIES: Record<AbilityType, Ability> = loadAbilities();

// Get random abilities for carousel (3 at a time)
export function getRandomAbilities(count: number = 3): Ability[] {
  const allAbilities = Object.values(ABILITIES);
  const shuffled = [...allAbilities].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

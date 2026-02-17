import type { Ability, AbilityType } from './types';
import abilitiesConfig from './abilities.json';

type AbilityConfigMap = typeof abilitiesConfig.abilities;
type AbilityIdFromConfig = keyof AbilityConfigMap;
type MissingAbilityIdsFromTypes = Exclude<AbilityIdFromConfig, AbilityType>;
type MissingAbilityIdsFromConfig = Exclude<AbilityType, AbilityIdFromConfig>;
const _abilityTypeParityCheck: [MissingAbilityIdsFromTypes, MissingAbilityIdsFromConfig] extends [never, never] ? true : never = true;
void _abilityTypeParityCheck;

const ABILITY_DEFINITIONS = abilitiesConfig.abilities as Record<AbilityType, Ability>;

// Load abilities from JSON config.
const loadAbilities = (): Record<AbilityType, Ability> => {
  const abilities: Partial<Record<AbilityType, Ability>> = {};
  const costFactor = abilitiesConfig.costFactor;

  for (const [key, abilityData] of Object.entries(ABILITY_DEFINITIONS)) {
    const abilityId = key as AbilityType;
    abilities[abilityId] = {
      ...abilityData,
      cost: abilityData.cost * costFactor,
    };
  }

  return abilities as Record<AbilityType, Ability>;
};

export const ABILITIES: Record<AbilityType, Ability> = loadAbilities();
export const ABILITY_IDS: AbilityType[] = Object.keys(ABILITIES) as AbilityType[];
export const ABILITY_LIST: Ability[] = ABILITY_IDS.map((id) => ABILITIES[id]);

export function isAbilityType(value: string): value is AbilityType {
  return value in ABILITIES;
}

export function getAbilityById(id: string): Ability | undefined {
  return isAbilityType(id) ? ABILITIES[id] : undefined;
}

// Get random abilities for carousel (3 at a time).
export function getRandomAbilities(count: number = 3): Ability[] {
  const pool = [...ABILITY_LIST];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

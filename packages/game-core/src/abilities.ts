import type { Ability, AbilityCategory, AbilityType } from './types';
import abilitiesConfig from './abilities.json';

type AbilityTargeting = 'self' | 'opponent';
type AbilityCatalogConfig = {
  costFactor?: number;
  abilities?: Record<string, unknown>;
};

type RawAbilityDefinition = Partial<Ability> & {
  id: string;
  type: string;
  name: string;
  shortName: string;
  description: string;
  cost: number;
  category: string;
  unlockCost: number;
  duration?: number;
  unlockLevel?: number;
  unlockTier?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isAbilityDefinition(value: unknown): value is RawAbilityDefinition {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.name === 'string' &&
    typeof value.shortName === 'string' &&
    typeof value.description === 'string' &&
    typeof value.cost === 'number' &&
    typeof value.category === 'string' &&
    typeof value.unlockCost === 'number'
  );
}

function normalizeCategory(category: string): AbilityCategory {
  return category as AbilityCategory;
}

function normalizeAbility(id: string, raw: RawAbilityDefinition, costFactor: number): Ability {
  const unlockTier =
    typeof raw.unlockTier === 'number'
      ? raw.unlockTier
      : typeof raw.unlockLevel === 'number'
        ? raw.unlockLevel
        : 1;
  const unlockLevel = typeof raw.unlockLevel === 'number' ? raw.unlockLevel : unlockTier;

  return {
    ...raw,
    id,
    type: id,
    category: normalizeCategory(raw.category),
    cost: raw.cost * costFactor,
    duration: typeof raw.duration === 'number' ? raw.duration : undefined,
    unlockTier,
    unlockLevel,
  };
}

function loadAbilities(): Record<AbilityType, Ability> {
  const catalog = abilitiesConfig as AbilityCatalogConfig;
  const rawAbilities = isRecord(catalog.abilities) ? catalog.abilities : {};
  const costFactor = typeof catalog.costFactor === 'number' ? catalog.costFactor : 1;

  const entries: Array<[AbilityType, Ability]> = [];
  for (const [id, rawValue] of Object.entries(rawAbilities)) {
    if (!isAbilityDefinition(rawValue)) continue;
    entries.push([id, normalizeAbility(id, rawValue, costFactor)]);
  }

  return Object.fromEntries(entries) as Record<AbilityType, Ability>;
}

export const ABILITIES: Record<AbilityType, Ability> = loadAbilities();
export const ABILITY_IDS: AbilityType[] = Object.keys(ABILITIES);
export const ABILITY_LIST: Ability[] = ABILITY_IDS.map((id) => ABILITIES[id]);

export function getAbilityById(abilityType: string): Ability | undefined {
  return ABILITIES[abilityType];
}

export function isAbilityType(abilityType: string): abilityType is AbilityType {
  return Object.prototype.hasOwnProperty.call(ABILITIES, abilityType);
}

export function isDebuffCategory(category: string): boolean {
  return category === 'debuff' || category.startsWith('debuff_');
}

export function isBuffCategory(category: string): boolean {
  return category === 'buff' || category.startsWith('buff_');
}

export function isDefensiveCategory(category: string): boolean {
  return category === 'defensive';
}

export function isDebuffAbility(ability: Ability | string): boolean {
  const resolved = typeof ability === 'string' ? getAbilityById(ability) : ability;
  return !!resolved && isDebuffCategory(resolved.category);
}

export function isBuffAbility(ability: Ability | string): boolean {
  const resolved = typeof ability === 'string' ? getAbilityById(ability) : ability;
  return !!resolved && isBuffCategory(resolved.category);
}

export function isDefensiveAbility(ability: Ability | string): boolean {
  const resolved = typeof ability === 'string' ? getAbilityById(ability) : ability;
  return !!resolved && isDefensiveCategory(resolved.category);
}

export function getAbilityTargeting(ability: Ability | string): AbilityTargeting {
  const resolved = typeof ability === 'string' ? getAbilityById(ability) : ability;
  if (!resolved) return 'opponent';
  return isDebuffCategory(resolved.category) ? 'opponent' : 'self';
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

// Get random abilities for carousel (3 at a time)
export function getRandomAbilities(count: number = 3): Ability[] {
  const shuffled = [...ABILITY_LIST];
  shuffleInPlace(shuffled);
  return shuffled.slice(0, Math.max(0, count));
}

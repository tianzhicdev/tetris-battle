import { describe, it, expect } from 'vitest';
import {
  ABILITY_IDS,
  ABILITY_LIST,
  getAbilityTargeting,
  isAbilityDefinition,
  isBuffCategory,
  isDebuffCategory,
  isDefensiveCategory,
} from '../abilities';
import catalogJson from '../abilities.json';

const RAW_CATALOG = catalogJson.abilities as Record<string, unknown>;
type CatalogAbility = {
  id: string;
  type: string;
  cost: number;
  category: string;
  unlockCost: number;
  duration?: number;
  unlockLevel?: number;
  unlockTier?: number;
};

const CATALOG: Array<[string, CatalogAbility]> = Object.entries(RAW_CATALOG)
  .filter(([, value]) => isAbilityDefinition(value))
  .map(([id, value]) => [id, value as CatalogAbility]);

describe('Ability catalog integrity', () => {
  it('every ability definition in catalog has an entry in ABILITIES', () => {
    const catalogIds = CATALOG.map(([id]) => id);
    const missing = catalogIds.filter((id) => !ABILITY_IDS.includes(id));
    expect(missing).toHaveLength(0);
  });

  it('filters out tier separator pseudo-entries', () => {
    const runtimeIds = new Set(ABILITY_IDS);
    expect([...runtimeIds].some((id) => id.startsWith('________'))).toBe(false);
  });

  it('removes deprecated row_rotate from runtime catalog', () => {
    expect(ABILITY_IDS).not.toContain('row_rotate');
  });

  it('all abilities have positive star cost', () => {
    CATALOG.forEach(([id, ability]) => {
      expect(ability.cost, `${id} has non-positive cost`).toBeGreaterThan(0);
    });
  });

  it('all abilities have valid category', () => {
    CATALOG.forEach(([id, ability]) => {
      const valid =
        isBuffCategory(ability.category) ||
        isDebuffCategory(ability.category) ||
        isDefensiveCategory(ability.category);
      expect(valid, `${id} has unknown category "${ability.category}"`).toBe(true);
    });
  });

  it('all abilities have non-negative unlockCost', () => {
    CATALOG.forEach(([id, ability]) => {
      expect(ability.unlockCost, `${id} has negative unlockCost`).toBeGreaterThanOrEqual(0);
    });
  });

  it('all abilities have unlockTier/unlockLevel >= 1', () => {
    CATALOG.forEach(([id, ability]) => {
      const unlockValue = typeof ability.unlockTier === 'number'
        ? ability.unlockTier
        : typeof ability.unlockLevel === 'number'
          ? ability.unlockLevel
          : 1;
      expect(unlockValue, `${id} has unlockTier/unlockLevel < 1`).toBeGreaterThanOrEqual(1);
    });
  });

  it('abilities with duration have non-negative duration', () => {
    CATALOG.forEach(([id, ability]) => {
      if (ability.duration !== undefined) {
        expect(ability.duration, `${id} has negative duration`).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it('starter abilities (unlockCost=0, unlock tier 1) have low star cost', () => {
    const starters = CATALOG.filter(
      ([, a]) => (a.unlockTier ?? a.unlockLevel ?? 1) === 1 && a.unlockCost === 0
    );
    expect(starters.length).toBeGreaterThan(0);
    starters.forEach(([id, a]) => {
      expect(a.cost, `Starter ${id} should cost ≤ 100 stars`).toBeLessThanOrEqual(100);
    });
  });

  it('id field matches the catalog key', () => {
    CATALOG.forEach(([key, ability]) => {
      expect(ability.id, `${key}: id field should match key`).toBe(key);
      expect(ability.type, `${key}: type field should match key`).toBe(key);
    });
  });

  it('includes newly-added v2 abilities', () => {
    const required = [
      'clone',
      'reflect',
      'shield',
      'purge',
      'quicksand',
      'wide_load',
      'narrow_escape',
      'fog_of_war',
      'gravity_well',
      'overcharge',
      'magnet',
      'time_warp',
      'garbage_rain',
      'column_swap',
      'shapeshifter',
      'tilt',
      'flip_board',
      'ink_splash',
    ];
    for (const id of required) {
      expect(ABILITY_IDS, `Missing v2 ability: ${id}`).toContain(id);
    }
  });

  it('targeting helper maps debuffs to opponent and others to self', () => {
    for (const ability of ABILITY_LIST) {
      const targeting = getAbilityTargeting(ability);
      if (isDebuffCategory(ability.category)) {
        expect(targeting, `${ability.id} should target opponent`).toBe('opponent');
      } else {
        expect(targeting, `${ability.id} should target self`).toBe('self');
      }
    }
  });
});

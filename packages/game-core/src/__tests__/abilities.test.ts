import { describe, it, expect } from 'vitest';
import { ABILITIES } from '../abilities';
import catalogJson from '../abilities.json';

const CATALOG = catalogJson.abilities as Record<string, {
  id: string;
  type: string;
  cost: number;
  category: string;
  unlockLevel: number;
  unlockCost: number;
  duration?: number;
}>;

describe('Ability catalog integrity', () => {
  it('every ability in catalog has an entry in ABILITIES', () => {
    const catalogIds = Object.keys(CATALOG);
    const abilitiesIds = Object.keys(ABILITIES);
    const missing = catalogIds.filter((id) => !abilitiesIds.includes(id));
    expect(missing).toHaveLength(0);
  });

  it('all abilities have positive star cost', () => {
    Object.entries(CATALOG).forEach(([id, ability]) => {
      expect(ability.cost, `${id} has non-positive cost`).toBeGreaterThan(0);
    });
  });

  it('all abilities have valid category', () => {
    Object.entries(CATALOG).forEach(([id, ability]) => {
      expect(['buff', 'debuff'], `${id} has unknown category "${ability.category}"`).toContain(
        ability.category
      );
    });
  });

  it('all abilities have non-negative unlockCost', () => {
    Object.entries(CATALOG).forEach(([id, ability]) => {
      expect(ability.unlockCost, `${id} has negative unlockCost`).toBeGreaterThanOrEqual(0);
    });
  });

  it('all abilities have unlockLevel >= 1', () => {
    Object.entries(CATALOG).forEach(([id, ability]) => {
      expect(ability.unlockLevel, `${id} has unlockLevel < 1`).toBeGreaterThanOrEqual(1);
    });
  });

  it('abilities with duration have positive duration', () => {
    Object.entries(CATALOG).forEach(([id, ability]) => {
      if (ability.duration !== undefined) {
        expect(ability.duration, `${id} has non-positive duration`).toBeGreaterThan(0);
      }
    });
  });

  it('starter abilities (unlockCost=0, unlockLevel=1) have low star cost', () => {
    const starters = Object.entries(CATALOG).filter(
      ([, a]) => a.unlockLevel === 1 && a.unlockCost === 0
    );
    expect(starters.length).toBeGreaterThan(0);
    starters.forEach(([id, a]) => {
      expect(a.cost, `Starter ${id} should cost ≤ 100 stars`).toBeLessThanOrEqual(100);
    });
  });

  it('id field matches the catalog key', () => {
    Object.entries(CATALOG).forEach(([key, ability]) => {
      expect(ability.id, `${key}: id field should match key`).toBe(key);
      expect(ability.type, `${key}: type field should match key`).toBe(key);
    });
  });
});

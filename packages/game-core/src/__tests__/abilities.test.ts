import { describe, it, expect } from 'vitest';
import {
  ABILITIES,
  ABILITY_IDS,
  ABILITY_LIST,
  getAbilityById,
  getRandomAbilities,
  isAbilityType,
} from '../abilities';

describe('abilities catalog', () => {
  it('keeps IDs/list/map aligned', () => {
    expect(ABILITY_IDS.length).toBe(ABILITY_LIST.length);
    expect(ABILITY_IDS.length).toBe(Object.keys(ABILITIES).length);
  });

  it('supports type guard and lookup', () => {
    const sampleId = ABILITY_IDS[0];
    expect(isAbilityType(sampleId)).toBe(true);
    expect(getAbilityById(sampleId)?.id).toBe(sampleId);

    expect(isAbilityType('not_real_ability')).toBe(false);
    expect(getAbilityById('not_real_ability')).toBeUndefined();
  });

  it('returns bounded random selections', () => {
    const picks = getRandomAbilities(3);
    expect(picks.length).toBeLessThanOrEqual(3);
    expect(picks.length).toBeGreaterThan(0);

    const oversized = getRandomAbilities(999);
    expect(oversized.length).toBe(ABILITY_IDS.length);
  });
});

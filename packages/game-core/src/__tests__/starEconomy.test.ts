import { describe, it, expect } from 'vitest';
import { calculateStars, calculateLineClearBaseStars, STAR_VALUES } from '../index';

describe('Star economy v2', () => {
  it('uses v2 base line-clear rates', () => {
    expect(calculateLineClearBaseStars(1)).toBe(5);
    expect(calculateLineClearBaseStars(2)).toBe(12);
    expect(calculateLineClearBaseStars(3)).toBe(22);
    expect(calculateLineClearBaseStars(4)).toBe(35);
  });

  it('applies combo bonus at +3 per combo level', () => {
    expect(calculateStars(2, 0)).toBe(12);
    expect(calculateStars(2, 2)).toBe(12 + 2 * STAR_VALUES.comboBonus);
  });

  it('adds back-to-back bonus', () => {
    expect(calculateStars(4, { backToBack: true, includeComboBonus: false })).toBe(
      35 + STAR_VALUES.backToBackBonus
    );
  });

  it('adds t-spin bonuses additively', () => {
    expect(calculateStars(1, { tSpin: 'single', includeComboBonus: false })).toBe(
      5 + STAR_VALUES.tSpinSingleBonus
    );
    expect(calculateStars(2, { tSpin: 'double', includeComboBonus: false })).toBe(
      12 + STAR_VALUES.tSpinDoubleBonus
    );
    expect(calculateStars(3, { tSpin: 'triple', includeComboBonus: false })).toBe(
      22 + STAR_VALUES.tSpinTripleBonus
    );
  });
});

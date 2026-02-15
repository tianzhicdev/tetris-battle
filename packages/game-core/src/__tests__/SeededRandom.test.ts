import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../SeededRandom';
import { getRandomTetrominoSeeded } from '../tetrominos';

describe('SeededRandom', () => {
  it('should produce same sequence with same seed', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(42);

    const sequence1 = Array.from({ length: 10 }, () => rng1.next());
    const sequence2 = Array.from({ length: 10 }, () => rng2.next());

    expect(sequence1).toEqual(sequence2);
  });

  it('should produce different sequences with different seeds', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(123);

    const sequence1 = Array.from({ length: 10 }, () => rng1.next());
    const sequence2 = Array.from({ length: 10 }, () => rng2.next());

    expect(sequence1).not.toEqual(sequence2);
  });

  it('should generate values in range [0, 1)', () => {
    const rng = new SeededRandom(42);

    for (let i = 0; i < 100; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('should generate integers in range [0, max)', () => {
    const rng = new SeededRandom(42);

    for (let i = 0; i < 100; i++) {
      const value = rng.nextInt(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('should generate all 7 tetromino types eventually', () => {
    const rng = new SeededRandom(42);
    const types = new Set<string>();

    // Generate 100 pieces, should cover all 7 types
    for (let i = 0; i < 100; i++) {
      const type = getRandomTetrominoSeeded(rng);
      types.add(type);
    }

    expect(types.size).toBe(7);
    expect(types.has('I')).toBe(true);
    expect(types.has('O')).toBe(true);
    expect(types.has('T')).toBe(true);
    expect(types.has('S')).toBe(true);
    expect(types.has('Z')).toBe(true);
    expect(types.has('L')).toBe(true);
    expect(types.has('J')).toBe(true);
  });

  it('should produce deterministic tetromino sequences', () => {
    const rng1 = new SeededRandom(12345);
    const rng2 = new SeededRandom(12345);

    const pieces1 = Array.from({ length: 20 }, () => getRandomTetrominoSeeded(rng1));
    const pieces2 = Array.from({ length: 20 }, () => getRandomTetrominoSeeded(rng2));

    expect(pieces1).toEqual(pieces2);
  });
});

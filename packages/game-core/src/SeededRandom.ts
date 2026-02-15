/**
 * Seeded Random Number Generator
 *
 * Uses Linear Congruential Generator (LCG) algorithm for deterministic randomness.
 * Same seed always produces the same sequence of random numbers.
 *
 * This is essential for server-authoritative mode: both players get the same
 * piece sequence when using the same seed.
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /**
   * Returns a random float in the range [0, 1)
   */
  next(): number {
    // LCG parameters (from Numerical Recipes)
    this.seed = (this.seed * 1664525 + 1013904223) % (2 ** 32);
    return this.seed / (2 ** 32);
  }

  /**
   * Returns a random integer in the range [0, max)
   */
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  /**
   * Get current seed (for debugging/testing)
   */
  getSeed(): number {
    return this.seed;
  }
}

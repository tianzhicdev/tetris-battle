/**
 * Block Animation Manager
 * Provides consistent animations for block manipulation abilities
 */

export type AnimationType = 'fade-out' | 'fade-in' | 'flash' | 'shake' | 'explode' | 'burn';

export interface BlockAnimation {
  x: number;
  y: number;
  type: AnimationType;
  startTime: number;
  duration: number; // milliseconds
  color?: string;
}

export class BlockAnimationManager {
  private animations: BlockAnimation[] = [];
  private readonly DEFAULT_DURATION = 300; // ms

  /**
   * Add blocks disappearing animation
   */
  animateBlocksDisappearing(positions: Array<{ x: number; y: number }>, color?: string): void {
    const now = Date.now();
    positions.forEach(({ x, y }) => {
      this.animations.push({
        x,
        y,
        type: 'fade-out',
        startTime: now,
        duration: this.DEFAULT_DURATION,
        color,
      });
    });
  }

  /**
   * Add blocks appearing animation
   */
  animateBlocksAppearing(positions: Array<{ x: number; y: number }>, color?: string): void {
    const now = Date.now();
    positions.forEach(({ x, y }) => {
      this.animations.push({
        x,
        y,
        type: 'fade-in',
        startTime: now,
        duration: this.DEFAULT_DURATION,
        color,
      });
    });
  }

  /**
   * Add blocks flashing animation (for affected areas)
   */
  animateBlocksFlashing(positions: Array<{ x: number; y: number }>, color: string = '#ffff00'): void {
    const now = Date.now();
    positions.forEach(({ x, y }) => {
      this.animations.push({
        x,
        y,
        type: 'flash',
        startTime: now,
        duration: 150, // Quick flash
        color,
      });
    });
  }

  /**
   * Add explosion animation (for bombs)
   */
  animateExplosion(centerX: number, centerY: number, radius: number, color: string = '#ff4444'): void {
    const now = Date.now();
    // Create expanding circle of animations
    for (let r = 0; r <= radius; r++) {
      const delay = r * 50; // Stagger the explosion
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const x = Math.round(centerX + Math.cos(angle) * r);
        const y = Math.round(centerY + Math.sin(angle) * r);
        this.animations.push({
          x,
          y,
          type: 'explode',
          startTime: now + delay,
          duration: 200,
          color,
        });
      }
    }
  }

  /**
   * Add burning fire animation (for bomb-cleared blocks)
   */
  animateBlocksBurning(positions: Array<{ x: number; y: number }>): void {
    const now = Date.now();
    positions.forEach(({ x, y }) => {
      this.animations.push({
        x,
        y,
        type: 'burn',
        startTime: now,
        duration: 600, // Longer duration for burning effect
        color: '#ff6a00', // Orange fire
      });
    });
  }

  /**
   * Get all active animations
   */
  getActiveAnimations(): BlockAnimation[] {
    const now = Date.now();
    // Filter out expired animations
    this.animations = this.animations.filter(
      anim => now - anim.startTime < anim.duration
    );
    return this.animations;
  }

  /**
   * Get animation progress for a specific block (0-1)
   */
  getAnimationProgress(anim: BlockAnimation): number {
    const now = Date.now();
    const elapsed = now - anim.startTime;
    return Math.min(1, elapsed / anim.duration);
  }

  /**
   * Clear all animations
   */
  clearAll(): void {
    this.animations = [];
  }

  /**
   * Helper: Calculate alpha for fade animations
   */
  getFadeAlpha(anim: BlockAnimation, progress: number): number {
    if (anim.type === 'fade-out') {
      return 1 - progress; // Start at 1, go to 0
    } else if (anim.type === 'fade-in') {
      return progress; // Start at 0, go to 1
    } else if (anim.type === 'flash') {
      // Flash: 0 -> 1 -> 0 (sine wave)
      return Math.sin(progress * Math.PI);
    }
    return 1;
  }

  /**
   * Helper: Calculate scale for explosion animations
   */
  getExplosionScale(progress: number): number {
    // Start small, grow, then shrink
    return 1 + Math.sin(progress * Math.PI) * 0.5;
  }
}

/**
 * Haptics utility for web using the Vibration API
 * Works on Android, silently fails on iOS (disabled for privacy)
 */

export const haptics = {
  /**
   * Light tap - for subtle feedback
   * Use for: piece locks, counter updates
   */
  light: () => {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  },

  /**
   * Medium impact - for important actions
   * Use for: line clears, ability activations
   */
  medium: () => {
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  },

  /**
   * Heavy impact - for major events
   * Use for: tetris (4 lines), bomb explosions, game over
   */
  heavy: () => {
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
  },

  /**
   * Success pattern - for achievements
   * Use for: victory, level up, milestone reached
   */
  success: () => {
    if (navigator.vibrate) {
      navigator.vibrate([10, 20, 10, 20, 10]);
    }
  },

  /**
   * Error pattern - for warnings/attacks
   * Use for: opponent attacks, invalid moves, game over
   */
  error: () => {
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  },

  /**
   * Double tap - for special events
   * Use for: ability unlocked, combo achieved
   */
  doubleTap: () => {
    if (navigator.vibrate) {
      navigator.vibrate([50, 100, 50]);
    }
  },
};

/**
 * Haptics utility for web and native iOS/Android
 * Uses Capacitor Haptics API on native platforms, falls back to Vibration API on web
 */

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export const haptics = {
  /**
   * Light tap - for subtle feedback
   * Use for: piece locks, counter updates
   */
  light: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  },

  /**
   * Medium impact - for important actions
   * Use for: line clears, ability activations
   */
  medium: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  },

  /**
   * Heavy impact - for major events
   * Use for: tetris (4 lines), bomb explosions, game over
   */
  heavy: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } else if (navigator.vibrate) {
      navigator.vibrate(100);
    }
  },

  /**
   * Success pattern - for achievements
   * Use for: victory, level up, milestone reached
   */
  success: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (navigator.vibrate) {
      navigator.vibrate([10, 20, 10, 20, 10]);
    }
  },

  /**
   * Error pattern - for warnings/attacks
   * Use for: opponent attacks, invalid moves, game over
   */
  error: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Error });
    } else if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  },

  /**
   * Double tap - for special events
   * Use for: ability unlocked, combo achieved
   */
  doubleTap: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Warning });
    } else if (navigator.vibrate) {
      navigator.vibrate([50, 100, 50]);
    }
  },
};

/**
 * Animation variants and configurations for Framer Motion
 * Centralized place for all animation timings and styles
 */

import type { Transition, Variants } from 'framer-motion';

// Spring configurations
export const springs = {
  // Bouncy spring for interactive elements
  bouncy: {
    type: 'spring',
    stiffness: 400,
    damping: 17,
  } as Transition,

  // Smooth spring for layout changes
  smooth: {
    type: 'spring',
    stiffness: 300,
    damping: 25,
  } as Transition,

  // Snappy spring for quick interactions
  snappy: {
    type: 'spring',
    stiffness: 500,
    damping: 20,
  } as Transition,

  // Gentle spring for score updates
  gentle: {
    type: 'spring',
    stiffness: 200,
    damping: 30,
  } as Transition,
};

// Button variants
export const buttonVariants: Variants = {
  initial: {
    scale: 0,
    opacity: 0,
  },
  animate: {
    scale: 1,
    opacity: 1,
  },
  hover: {
    scale: 1.05,
  },
  tap: {
    scale: 0.95,
  },
  disabled: {
    scale: 1,
    opacity: 0.5,
  },
};

// Score counter variants
export const scoreVariants: Variants = {
  initial: {
    y: -20,
    opacity: 0,
  },
  animate: {
    y: 0,
    opacity: 1,
  },
  exit: {
    y: 20,
    opacity: 0,
  },
};

// Modal/overlay variants
export const overlayVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
  },
  exit: {
    opacity: 0,
  },
};

export const modalVariants: Variants = {
  hidden: {
    scale: 0.8,
    opacity: 0,
    y: 50,
  },
  visible: {
    scale: 1,
    opacity: 1,
    y: 0,
  },
  exit: {
    scale: 0.8,
    opacity: 0,
    y: 50,
  },
};

// Flash effect for line clears
export const flashVariants: Variants = {
  initial: {
    opacity: 0,
  },
  flash: {
    opacity: [0, 0.8, 0],
  },
};

// Shake effect for impacts
export const shakeVariants: Variants = {
  initial: {
    x: 0,
  },
  shake: {
    x: [0, -5, 5, -5, 5, 0],
  },
};

// Pulse effect for active abilities
export const pulseVariants: Variants = {
  initial: {
    scale: 1,
  },
  pulse: {
    scale: [1, 1.2, 1],
  },
};

// Slide in from bottom (for notifications)
export const slideUpVariants: Variants = {
  hidden: {
    y: 100,
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
  },
  exit: {
    y: 100,
    opacity: 0,
  },
};

// Stagger children animation
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
  },
};

// Timing constants (ms)
export const timings = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
  flash: 0.2,
  shake: 0.4,
  pulse: 1,
};

import { motion } from 'framer-motion';
import { flashVariants, timings } from '../utils/animations';

interface FlashOverlayProps {
  color?: string;
  onComplete?: () => void;
}

export function FlashOverlay({ color = 'rgba(255, 255, 255, 0.9)', onComplete }: FlashOverlayProps) {
  return (
    <motion.div
      variants={flashVariants}
      initial="initial"
      animate="flash"
      transition={{ duration: timings.flash }}
      onAnimationComplete={onComplete}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: color,
        pointerEvents: 'none',
        zIndex: 9998,
      }}
    />
  );
}

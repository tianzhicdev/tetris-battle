import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import { buttonVariants, springs } from '../../utils/animations';

interface GameTouchControlsProps {
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onHardDrop: () => void;
  onSoftDrop: () => void;
  onRotateCw: () => void;
}

const baseButton: CSSProperties = {
  background: 'rgba(10, 10, 30, 0.62)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  color: '#fff',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'manipulation',
  backdropFilter: 'blur(16px)',
};

export function GameTouchControls({ onMoveLeft, onMoveRight, onHardDrop, onSoftDrop, onRotateCw }: GameTouchControlsProps) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        gap: '8px',
        padding: '10px',
        background: 'linear-gradient(180deg, rgba(10,10,25,0.3) 0%, rgba(5,5,15,0.85) 100%)',
        borderTop: '1px solid rgba(0, 212, 255, 0.25)',
      }}
    >
      <motion.button
        whileTap="tap"
        variants={buttonVariants}
        transition={springs.snappy}
        onPointerDown={(e) => { e.preventDefault(); onMoveLeft(); }}
        style={{ ...baseButton, flex: 1 }}
      >
        ◀
      </motion.button>

      <motion.button
        whileTap="tap"
        variants={buttonVariants}
        transition={springs.snappy}
        onPointerDown={(e) => {
          e.preventDefault();
          onHardDrop();
        }}
        style={{
          ...baseButton,
          flex: 1.2,
          border: '2px solid rgba(255, 0, 110, 0.45)',
          boxShadow: '0 0 18px rgba(255, 0, 110, 0.22)',
          fontSize: '12px',
          fontWeight: 800,
          letterSpacing: '0.5px',
        }}
      >
        DROP
      </motion.button>

      <motion.button
        whileTap="tap"
        variants={buttonVariants}
        transition={springs.snappy}
        onPointerDown={(e) => { e.preventDefault(); onSoftDrop(); }}
        style={{ ...baseButton, flex: 1 }}
      >
        ▼
      </motion.button>

      <motion.button
        whileTap="tap"
        variants={buttonVariants}
        transition={springs.snappy}
        onPointerDown={(e) => { e.preventDefault(); onRotateCw(); }}
        style={{ ...baseButton, flex: 1 }}
      >
        ⟳
      </motion.button>

      <motion.button
        whileTap="tap"
        variants={buttonVariants}
        transition={springs.snappy}
        onPointerDown={(e) => { e.preventDefault(); onMoveRight(); }}
        style={{ ...baseButton, flex: 1 }}
      >
        ▶
      </motion.button>
    </div>
  );
}

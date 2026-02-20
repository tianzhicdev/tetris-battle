import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import { buttonVariants, springs } from '../../utils/animations';
import { Icon } from '../ui/Icon';

interface GameTouchControlsProps {
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onHardDrop: () => void;
  onSoftDrop: () => void;
  onRotateCw: () => void;
}

const baseButton: CSSProperties = {
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '10px',
  color: 'rgba(255,255,255,0.19)',
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'manipulation',
  fontFamily: 'system-ui',
  WebkitTapHighlightColor: 'transparent',
};

export function GameTouchControls({ onMoveLeft, onMoveRight, onHardDrop, onSoftDrop, onRotateCw }: GameTouchControlsProps) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        gap: '6px',
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
        style={{ ...baseButton, flex: 1, fontSize: 14 }}
      >
        <Icon type="control" name="left" color="rgba(255,255,255,0.19)" size={20} />
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
          width: 56,
          fontSize: 12,
        }}
      >
        <Icon type="control" name="drop" color="rgba(255,255,255,0.19)" size={20} />
      </motion.button>

      <motion.button
        whileTap="tap"
        variants={buttonVariants}
        transition={springs.snappy}
        onPointerDown={(e) => { e.preventDefault(); onSoftDrop(); }}
        style={{ ...baseButton, flex: 1, fontSize: 14 }}
      >
        <Icon type="control" name="down" color="rgba(255,255,255,0.19)" size={20} />
      </motion.button>

      <motion.button
        whileTap="tap"
        variants={buttonVariants}
        transition={springs.snappy}
        onPointerDown={(e) => { e.preventDefault(); onRotateCw(); }}
        style={{ ...baseButton, flex: 1, fontSize: 18 }}
      >
        <Icon type="control" name="rotate" color="rgba(255,255,255,0.19)" size={20} />
      </motion.button>

      <motion.button
        whileTap="tap"
        variants={buttonVariants}
        transition={springs.snappy}
        onPointerDown={(e) => { e.preventDefault(); onMoveRight(); }}
        style={{ ...baseButton, flex: 1, fontSize: 14 }}
      >
        <Icon type="control" name="right" color="rgba(255,255,255,0.19)" size={20} />
      </motion.button>
    </div>
  );
}

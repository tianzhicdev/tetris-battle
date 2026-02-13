import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants, springs } from '../utils/animations';

interface AbilityNotificationProps {
  abilityName: string | null;
  description: string | null;
  category: 'buff' | 'debuff' | null;
}

export function AbilityNotification({ abilityName, description, category }: AbilityNotificationProps) {
  return (
    <AnimatePresence>
      {abilityName && (
        <motion.div
          variants={slideUpVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={springs.smooth}
          style={{
            position: 'fixed',
            top: 'clamp(50px, 10vh, 80px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            padding: 'clamp(8px, 2vw, 12px) clamp(16px, 4vw, 24px)',
            background: category === 'buff'
              ? 'rgba(0, 212, 255, 0.15)'
              : 'rgba(255, 0, 110, 0.15)',
            backdropFilter: 'blur(20px)',
            border: category === 'buff'
              ? '2px solid rgba(0, 212, 255, 0.6)'
              : '2px solid rgba(255, 0, 110, 0.6)',
            borderRadius: 'clamp(8px, 2vw, 12px)',
            boxShadow: category === 'buff'
              ? '0 0 30px rgba(0, 212, 255, 0.5), inset 0 0 20px rgba(0, 212, 255, 0.1)'
              : '0 0 30px rgba(255, 0, 110, 0.5), inset 0 0 20px rgba(255, 0, 110, 0.1)',
            textAlign: 'center',
            minWidth: 'clamp(200px, 60vw, 300px)',
            maxWidth: '90vw',
            pointerEvents: 'none',
          }}
        >
          <div style={{
            fontSize: 'clamp(14px, 3.5vw, 18px)',
            fontWeight: '800',
            color: category === 'buff' ? '#00d4ff' : '#ff006e',
            textShadow: category === 'buff'
              ? '0 0 15px rgba(0, 212, 255, 0.8)'
              : '0 0 15px rgba(255, 0, 110, 0.8)',
            marginBottom: '4px',
            letterSpacing: '1px',
          }}>
            {abilityName}
          </div>
          <div style={{
            fontSize: 'clamp(10px, 2.5vw, 13px)',
            color: '#ffffff',
            opacity: 0.9,
            lineHeight: '1.3',
          }}>
            {description}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

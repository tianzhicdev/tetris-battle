import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants, springs } from '../utils/animations';

export interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: 'success' | 'danger' | 'primary';
}

export interface NotificationProps {
  visible: boolean;
  title: string;
  message?: string;
  variant?: 'buff' | 'debuff' | 'info' | 'challenge' | 'warning';
  actions?: NotificationAction[];
  countdown?: number; // Seconds remaining (for challenges)
  onDismiss?: () => void;
}

export function Notification({
  visible,
  title,
  message,
  variant = 'info',
  actions,
  countdown,
  onDismiss
}: NotificationProps) {
  const getColors = () => {
    switch (variant) {
      case 'buff':
        return {
          bg: 'rgba(0, 212, 255, 0.15)',
          border: 'rgba(0, 212, 255, 0.6)',
          text: '#00d4ff',
          glow: 'rgba(0, 212, 255, 0.5)',
        };
      case 'debuff':
        return {
          bg: 'rgba(255, 0, 110, 0.15)',
          border: 'rgba(255, 0, 110, 0.6)',
          text: '#ff006e',
          glow: 'rgba(255, 0, 110, 0.5)',
        };
      case 'challenge':
        return {
          bg: 'rgba(201, 66, 255, 0.15)',
          border: 'rgba(201, 66, 255, 0.4)',
          text: '#c942ff',
          glow: 'rgba(201, 66, 255, 0.5)',
        };
      case 'warning':
        return {
          bg: 'rgba(255, 215, 0, 0.15)',
          border: 'rgba(255, 215, 0, 0.6)',
          text: '#ffd700',
          glow: 'rgba(255, 215, 0, 0.5)',
        };
      default: // info
        return {
          bg: 'rgba(100, 100, 120, 0.15)',
          border: 'rgba(200, 200, 220, 0.6)',
          text: '#ffffff',
          glow: 'rgba(200, 200, 220, 0.5)',
        };
    }
  };

  const colors = getColors();

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getButtonStyles = (actionVariant: NotificationAction['variant'] = 'primary') => {
    const baseStyles = {
      padding: 'clamp(8px, 2vw, 10px) clamp(20px, 5vw, 28px)',
      fontSize: 'clamp(12px, 3vw, 14px)',
      cursor: 'pointer',
      fontFamily: 'monospace',
      fontWeight: 'bold' as const,
      borderRadius: 'clamp(6px, 1.5vw, 8px)',
      transition: 'all 0.2s ease',
      border: 'none',
      backdropFilter: 'blur(10px)',
    };

    switch (actionVariant) {
      case 'success':
        return {
          ...baseStyles,
          background: 'rgba(0, 255, 136, 0.2)',
          color: '#00ff88',
          boxShadow: '0 0 10px rgba(0, 255, 136, 0.3)',
        };
      case 'danger':
        return {
          ...baseStyles,
          background: 'rgba(255, 0, 110, 0.2)',
          color: '#ff006e',
          boxShadow: '0 0 10px rgba(255, 0, 110, 0.3)',
        };
      default: // primary
        return {
          ...baseStyles,
          background: 'rgba(0, 212, 255, 0.2)',
          color: '#00d4ff',
          boxShadow: '0 0 10px rgba(0, 212, 255, 0.3)',
        };
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <div
          style={{
            position: 'fixed',
            top: 'clamp(20px, 4vh, 40px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            pointerEvents: 'none',
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
            padding: '0 clamp(10px, 2vw, 20px)',
          }}
        >
          <motion.div
            variants={slideUpVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={springs.smooth}
            style={{
              padding: 'clamp(12px, 3vw, 16px) clamp(16px, 4vw, 24px)',
              background: colors.bg,
              backdropFilter: 'blur(20px)',
              border: `2px solid ${colors.border}`,
              borderRadius: 'clamp(10px, 2.5vw, 16px)',
              boxShadow: `0 0 30px ${colors.glow}, inset 0 0 20px ${colors.bg}`,
              textAlign: 'center',
              minWidth: 'clamp(200px, 60vw, 400px)',
              maxWidth: 'min(500px, 90vw)',
              pointerEvents: 'auto',
            }}
          >
            <div style={{
              fontSize: 'clamp(14px, 3.5vw, 18px)',
              fontWeight: '800',
              color: colors.text,
              textShadow: `0 0 15px ${colors.glow}`,
              marginBottom: message || countdown !== undefined || actions ? 'clamp(6px, 1.5vw, 8px)' : 0,
              letterSpacing: '0.5px',
            }}>
              {title}
            </div>

            {message && (
              <div style={{
                fontSize: 'clamp(11px, 2.75vw, 14px)',
                color: '#ffffff',
                opacity: 0.9,
                lineHeight: '1.4',
                marginBottom: countdown !== undefined || actions ? 'clamp(8px, 2vw, 12px)' : 0,
              }}>
                {message}
              </div>
            )}

            {countdown !== undefined && (
              <div style={{
                fontSize: 'clamp(12px, 3vw, 14px)',
                color: countdown <= 30 ? '#ff006e' : '#ffd700',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                marginBottom: actions ? 'clamp(10px, 2.5vw, 12px)' : 0,
                textShadow: countdown <= 30 ? '0 0 10px rgba(255, 0, 110, 0.5)' : '0 0 10px rgba(255, 215, 0, 0.5)',
              }}>
                {formatCountdown(countdown)}
              </div>
            )}

            {actions && actions.length > 0 && (
              <div style={{
                display: 'flex',
                gap: 'clamp(8px, 2vw, 10px)',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}>
                {actions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={action.onClick}
                    style={getButtonStyles(action.variant)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

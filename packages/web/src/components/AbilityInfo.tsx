import { ABILITIES } from '@tetris-battle/game-core';
import type { Ability } from '@tetris-battle/game-core';
import { motion } from 'framer-motion';
import { overlayVariants, modalVariants, springs } from '../utils/animations';

interface AbilityInfoProps {
  onClose: () => void;
}

export function AbilityInfo({ onClose }: AbilityInfoProps) {
  const buffs = Object.values(ABILITIES).filter(a => a.category === 'buff');
  const debuffs = Object.values(ABILITIES).filter(a => a.category === 'debuff');

  const renderAbilityCard = (ability: Ability) => {
    const isBuff = ability.category === 'buff';
    const textColor = isBuff ? '#00d4ff' : '#ff006e';
    const glowColor = isBuff
      ? 'rgba(0, 212, 255, 0.6)'
      : 'rgba(255, 0, 110, 0.6)';

    return (
      <div
        key={ability.id}
        style={{
          background: 'rgba(10, 10, 30, 0.6)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '800',
            color: textColor,
            textShadow: `0 0 12px ${glowColor}`,
            letterSpacing: '0.5px',
          }}>
            {ability.shortName}
          </div>
          <div style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.6)',
          }}>
            {ability.cost} ★
          </div>
        </div>
        <div style={{
          fontSize: '14px',
          color: '#ffffff',
          lineHeight: '1.5',
          opacity: 0.9,
        }}>
          {ability.description}
        </div>
        {ability.duration && (
          <div style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.5)',
            fontStyle: 'italic',
          }}>
            Duration: {ability.duration > 1000 ? `${ability.duration / 1000}s` : `${ability.duration} pieces`}
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.92)',
        backdropFilter: 'blur(10px)',
        zIndex: 1000,
        overflowY: 'auto',
        padding: '20px',
      }}
    >
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={springs.smooth}
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          paddingBottom: '40px',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          background: 'linear-gradient(135deg, #0a0e27 0%, #1a1433 100%)',
          padding: '15px 0',
          borderBottom: '2px solid rgba(0, 212, 255, 0.3)',
        }}>
          <h2 style={{
            fontSize: 'clamp(24px, 6vw, 32px)',
            fontWeight: '700',
            color: '#00d4ff',
            textShadow: '0 0 20px rgba(0, 212, 255, 0.8)',
            margin: 0,
          }}>
            ABILITIES GUIDE
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(10, 10, 30, 0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '20px',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </div>

        {/* Buffs Section */}
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{
            fontSize: 'clamp(20px, 5vw, 24px)',
            fontWeight: '700',
            color: '#00d4ff',
            textShadow: '0 0 15px rgba(0, 212, 255, 0.6)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            BUFFS (Help You)
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '15px',
          }}>
            {buffs.map(renderAbilityCard)}
          </div>
        </div>

        {/* Debuffs Section */}
        <div>
          <h3 style={{
            fontSize: 'clamp(20px, 5vw, 24px)',
            fontWeight: '700',
            color: '#c942ff',
            textShadow: '0 0 15px rgba(201, 66, 255, 0.6)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            DEBUFFS (Attack Opponent)
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '15px',
          }}>
            {debuffs.map(renderAbilityCard)}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

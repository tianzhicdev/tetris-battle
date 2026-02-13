import { ABILITIES } from '@tetris-battle/game-core';
import type { Ability } from '@tetris-battle/game-core';

interface AbilityInfoProps {
  onClose: () => void;
}

export function AbilityInfo({ onClose }: AbilityInfoProps) {
  const buffs = Object.values(ABILITIES).filter(a => a.category === 'buff');
  const debuffs = Object.values(ABILITIES).filter(a => a.category === 'debuff');

  const renderAbilityCard = (ability: Ability) => {
    const isBuff = ability.category === 'buff';
    const gradient = isBuff
      ? 'linear-gradient(135deg, #00d4ff 0%, #0080ff 100%)'
      : 'linear-gradient(135deg, #c942ff 0%, #ff006e 100%)';
    const glowColor = isBuff
      ? 'rgba(0, 212, 255, 0.3)'
      : 'rgba(201, 66, 255, 0.3)';
    const borderColor = isBuff ? '#00d4ff' : '#c942ff';

    return (
      <div
        key={ability.id}
        style={{
          background: gradient,
          border: `2px solid ${borderColor}`,
          borderRadius: '12px',
          padding: '16px',
          boxShadow: `0 0 20px ${glowColor}, inset 0 0 15px rgba(255,255,255,0.1)`,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={ability.icon}
            alt={ability.name}
            style={{
              width: '48px',
              height: '48px',
              objectFit: 'contain',
              filter: `drop-shadow(0 0 8px ${glowColor})`,
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#ffffff',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            }}>
              {ability.name}
            </div>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.8)',
              marginTop: '2px',
            }}>
              Cost: {ability.cost} • Power: {ability.powerRating}/10
            </div>
          </div>
        </div>
        <div style={{
          fontSize: '14px',
          color: '#ffffff',
          lineHeight: '1.4',
          background: 'transparent',
          padding: '10px',
          borderRadius: '8px',
          border: 'none',
        }}>
          {ability.description}
        </div>
        {ability.duration && (
          <div style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.7)',
            fontStyle: 'italic',
          }}>
            Duration: {ability.duration > 1000 ? `${ability.duration / 1000}s` : `${ability.duration} pieces`}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
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
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        paddingBottom: '40px',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          position: 'sticky',
          top: 0,
          background: 'linear-gradient(135deg, #0a0e27 0%, #1a1433 100%)',
          padding: '15px 0',
          zIndex: 10,
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
              background: 'linear-gradient(135deg, #ff006e 0%, #ff4500 100%)',
              border: '2px solid #ff006e',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '20px',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 0 15px rgba(255, 0, 110, 0.5)',
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

        {/* Tips Section */}
        <div style={{
          marginTop: '40px',
          background: 'transparent',
          border: '1px solid rgba(0, 255, 136, 0.2)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: 'none',
        }}>
          <h4 style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#00ff88',
            marginBottom: '12px',
            textShadow: '0 0 10px rgba(0, 255, 136, 0.5)',
          }}>
            PRO TIPS
          </h4>
          <ul style={{
            color: '#ffffff',
            fontSize: '14px',
            lineHeight: '1.6',
            marginLeft: '20px',
          }}>
            <li>Earn stars by clearing lines and combos</li>
            <li>Buffs help you, debuffs attack your opponent</li>
            <li>Higher power rating = more impactful ability</li>
            <li>Manage your stars wisely - save for powerful abilities!</li>
            <li>Combine abilities strategically for maximum effect</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

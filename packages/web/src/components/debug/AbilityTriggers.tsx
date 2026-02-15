import { ABILITIES } from '@tetris-battle/game-core';

interface AbilityTriggersProps {
  onTrigger: (abilityType: string, target: 'self' | 'opponent') => void;
}

export function AbilityTriggers({ onTrigger }: AbilityTriggersProps) {
  const buffs = Object.values(ABILITIES).filter(a => a.category === 'buff');
  const debuffs = Object.values(ABILITIES).filter(a => a.category === 'debuff');

  const handleTrigger = (abilityType: string) => {
    const ability = ABILITIES[abilityType as keyof typeof ABILITIES];
    const target = ability.category === 'buff' ? 'self' : 'opponent';
    onTrigger(abilityType, target);
  };

  return (
    <div style={{ marginBottom: '12px', fontSize: '10px' }}>

      {/* Buffs */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ color: '#00aaff', marginBottom: '4px' }}>Self Buffs:</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {buffs.map(ability => (
            <button
              key={ability.id}
              onClick={() => handleTrigger(ability.type)}
              style={abilityButtonStyle('#00aaff')}
              title={`${ability.name} (${ability.cost} stars)`}
            >
              {ability.shortName}
            </button>
          ))}
        </div>
      </div>

      {/* Debuffs */}
      <div>
        <div style={{ color: '#ff6600', marginBottom: '4px' }}>Opponent Debuffs:</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {debuffs.map(ability => (
            <button
              key={ability.id}
              onClick={() => handleTrigger(ability.type)}
              style={abilityButtonStyle('#ff6600')}
              title={`${ability.name} (${ability.cost} stars)`}
            >
              {ability.shortName}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const abilityButtonStyle = (color: string): React.CSSProperties => ({
  padding: '4px 6px',
  fontSize: '9px',
  border: `1px solid ${color}`,
  borderRadius: '3px',
  backgroundColor: `${color}22`,
  color: color,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

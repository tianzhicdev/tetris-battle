import type { Ability } from '@tetris-battle/game-core';
import { isDebuffAbility } from '@tetris-battle/game-core';

interface AbilityCardProps {
  ability: Ability;
  isOwned: boolean;
  isEquipped: boolean;
  unlockCost: number;
  coins: number;
  onBuy: () => void;
  onEquip: () => void;
  onUnequip: () => void;
  isBuying: boolean;
  loadoutFull: boolean;
}

export function AbilityCard({
  ability,
  isOwned,
  isEquipped,
  unlockCost,
  coins,
  onBuy,
  onEquip,
  onUnequip,
  isBuying,
  loadoutFull,
}: AbilityCardProps) {
  const isDebuff = isDebuffAbility(ability);
  const accentColor = isDebuff ? '#ff006e' : '#00d4ff';
  const canAfford = coins >= unlockCost;
  const coinsNeeded = unlockCost - coins;

  return (
    <div
      style={{
        background: isEquipped
          ? 'rgba(0, 255, 136, 0.08)'
          : 'rgba(10, 10, 30, 0.6)',
        border: `1px solid ${isEquipped ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 255, 255, 0.15)'}`,
        borderRadius: 'clamp(8px, 2vw, 10px)',
        padding: 'clamp(10px, 2.5vw, 14px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(6px, 1.5vw, 8px)',
        transition: 'all 0.2s ease',
        boxShadow: isEquipped
          ? '0 4px 20px rgba(0, 255, 136, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          : '0 2px 10px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Header: badge + name + star cost */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span
          style={{
            padding: '2px 7px',
            borderRadius: '999px',
            border: `1px solid ${accentColor}`,
            color: accentColor,
            background: 'rgba(255, 255, 255, 0.04)',
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '0.4px',
            lineHeight: 1.2,
            flexShrink: 0,
          }}
        >
          {ability.shortName}
        </span>
        <span style={{ color: '#fff', fontSize: 'clamp(13px, 3.2vw, 14px)', fontWeight: 700, flex: 1 }}>
          {ability.name}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', flexShrink: 0 }}>
          {ability.cost}★
        </span>
      </div>

      {/* Description */}
      <div style={{
        fontSize: 'clamp(11px, 2.7vw, 12px)',
        color: 'rgba(255, 255, 255, 0.65)',
        lineHeight: 1.4,
      }}>
        {ability.description}
      </div>

      {/* Action button */}
      <div style={{ marginTop: 'auto', paddingTop: '2px' }}>
        {isEquipped ? (
          <button
            onClick={onUnequip}
            style={{
              width: '100%',
              padding: 'clamp(6px, 1.5vw, 8px)',
              background: 'rgba(0, 255, 136, 0.15)',
              color: '#00ff88',
              border: '1px solid rgba(0, 255, 136, 0.4)',
              borderRadius: 'clamp(4px, 1vw, 6px)',
              cursor: 'pointer',
              fontSize: 'clamp(11px, 2.7vw, 12px)',
              fontWeight: 700,
              transition: 'all 0.2s ease',
            }}
          >
            Unequip
          </button>
        ) : isOwned ? (
          <button
            onClick={onEquip}
            disabled={loadoutFull}
            style={{
              width: '100%',
              padding: 'clamp(6px, 1.5vw, 8px)',
              background: loadoutFull ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 212, 255, 0.15)',
              color: loadoutFull ? '#666' : '#00d4ff',
              border: `1px solid ${loadoutFull ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 212, 255, 0.4)'}`,
              borderRadius: 'clamp(4px, 1vw, 6px)',
              cursor: loadoutFull ? 'not-allowed' : 'pointer',
              fontSize: 'clamp(11px, 2.7vw, 12px)',
              fontWeight: 700,
              transition: 'all 0.2s ease',
            }}
          >
            {loadoutFull ? 'Loadout Full' : 'Equip'}
          </button>
        ) : canAfford ? (
          <button
            onClick={onBuy}
            disabled={isBuying}
            style={{
              width: '100%',
              padding: 'clamp(6px, 1.5vw, 8px)',
              background: 'rgba(255, 215, 0, 0.15)',
              color: '#ffd700',
              border: '1px solid rgba(255, 215, 0, 0.4)',
              borderRadius: 'clamp(4px, 1vw, 6px)',
              cursor: isBuying ? 'wait' : 'pointer',
              fontSize: 'clamp(11px, 2.7vw, 12px)',
              fontWeight: 700,
              transition: 'all 0.2s ease',
            }}
          >
            {isBuying ? 'Buying...' : `Buy (${unlockCost} coins)`}
          </button>
        ) : (
          <button
            disabled
            style={{
              width: '100%',
              padding: 'clamp(6px, 1.5vw, 8px)',
              background: 'rgba(255, 255, 255, 0.03)',
              color: '#666',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 'clamp(4px, 1vw, 6px)',
              cursor: 'not-allowed',
              fontSize: 'clamp(11px, 2.7vw, 12px)',
              fontWeight: 700,
            }}
          >
            Need {coinsNeeded} more
          </button>
        )}
      </div>
    </div>
  );
}

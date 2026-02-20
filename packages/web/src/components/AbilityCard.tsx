import type { Ability } from '@tetris-battle/game-core';
import { isDebuffAbility } from '@tetris-battle/game-core';
import { T } from '../design-tokens';

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
  const accentColor = isDebuff ? T.accent.pink : T.accent.cyan;
  const canAfford = coins >= unlockCost;
  const coinsNeeded = unlockCost - coins;

  return (
    <div
      style={{
        background: isEquipped
          ? `${T.accent.green}14`
          : T.bg.card,
        border: `1px solid ${isEquipped ? `${T.accent.green}80` : T.border.accent}`,
        borderRadius: `${T.radius.md}px`,
        padding: 'clamp(10px, 2.5vw, 14px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(6px, 1.5vw, 8px)',
        transition: 'all 0.2s ease',
        boxShadow: isEquipped
          ? `${T.glow(T.accent.green, 0.8)}, inset 0 1px 0 rgba(255, 255, 255, 0.1)`
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
        <span style={{ color: T.text.primary, fontSize: 'clamp(13px, 3.2vw, 14px)', fontWeight: 700, flex: 1 }}>
          {ability.name}
        </span>
        <span style={{ color: T.text.secondary, fontSize: '11px', flexShrink: 0 }}>
          {ability.cost}★
        </span>
      </div>

      {/* Description */}
      <div style={{
        fontSize: 'clamp(11px, 2.7vw, 12px)',
        color: T.text.secondary,
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
              background: `${T.accent.green}26`,
              color: T.accent.green,
              border: `1px solid ${T.accent.green}66`,
              borderRadius: `${T.radius.sm}px`,
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
              background: loadoutFull ? 'rgba(255, 255, 255, 0.05)' : `${T.accent.cyan}26`,
              color: loadoutFull ? T.text.tertiary : T.accent.cyan,
              border: `1px solid ${loadoutFull ? 'rgba(255, 255, 255, 0.1)' : `${T.accent.cyan}66`}`,
              borderRadius: `${T.radius.sm}px`,
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
              background: `${T.accent.yellow}26`,
              color: T.accent.yellow,
              border: `1px solid ${T.accent.yellow}66`,
              borderRadius: `${T.radius.sm}px`,
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
              color: T.text.tertiary,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: `${T.radius.sm}px`,
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

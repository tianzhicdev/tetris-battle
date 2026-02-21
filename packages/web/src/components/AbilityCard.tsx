import type { Ability } from '@tetris-battle/game-core';
import { isDebuffAbility } from '@tetris-battle/game-core';
import { T } from '../design-tokens';
import { Icon } from './ui/Icon';

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
        background: isEquipped ? `${accentColor}08` : T.bg.card,
        border: `1px solid ${isEquipped ? `${accentColor}33` : T.border.subtle}`,
        borderRadius: `${T.radius.md}px`,
        padding: 12,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {/* Header: icon + name + star cost */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Icon
          type="ability"
          name={ability.type}
          color={accentColor}
          size={24}
          active={isEquipped}
        />
        <div style={{ flex: 1, fontSize: 11, fontWeight: 700, fontFamily: T.font.display, color: T.text.primary, letterSpacing: 1 }}>
          {ability.name}
        </div>
        <div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.accent.purple }}>
          ★{ability.cost}
        </div>
      </div>

      {/* Description */}
      <div style={{
        fontSize: 10,
        color: T.text.secondary,
        lineHeight: 1.5,
        fontFamily: 'system-ui',
        marginBottom: 8,
      }}>
        {ability.description}
      </div>

      {/* Action button */}
      {isEquipped ? (
        <button
          onClick={onUnequip}
          style={{
            width: '100%',
            padding: '6px 0',
            background: `${accentColor}11`,
            border: `1px solid ${accentColor}44`,
            borderRadius: `${T.radius.sm}px`,
            color: accentColor,
            fontFamily: T.font.display,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: 2,
            cursor: 'pointer',
          }}
        >
          EQUIPPED
        </button>
      ) : isOwned ? (
        <button
          onClick={onEquip}
          disabled={loadoutFull}
          style={{
            width: '100%',
            padding: '6px 0',
            background: loadoutFull ? T.bg.button : T.bg.button,
            border: `1px solid ${loadoutFull ? T.border.subtle : T.border.subtle}`,
            borderRadius: `${T.radius.sm}px`,
            color: loadoutFull ? T.text.tertiary : T.text.secondary,
            fontFamily: T.font.display,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: 2,
            cursor: loadoutFull ? 'not-allowed' : 'pointer',
          }}
        >
          {loadoutFull ? 'LOADOUT FULL' : 'EQUIP'}
        </button>
      ) : canAfford ? (
        <button
          onClick={onBuy}
          disabled={isBuying}
          style={{
            width: '100%',
            padding: '6px 0',
            background: T.bg.button,
            border: `1px solid ${T.accent.yellow}44`,
            borderRadius: `${T.radius.sm}px`,
            color: T.accent.yellow,
            fontFamily: T.font.display,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: 2,
            cursor: isBuying ? 'wait' : 'pointer',
          }}
        >
          {isBuying ? 'BUYING...' : `BUY (${unlockCost} COINS)`}
        </button>
      ) : (
        <button
          disabled
          style={{
            width: '100%',
            padding: '6px 0',
            background: T.bg.button,
            border: `1px solid ${T.border.subtle}`,
            borderRadius: `${T.radius.sm}px`,
            color: T.text.tertiary,
            fontFamily: T.font.display,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: 2,
            cursor: 'not-allowed',
          }}
        >
          NEED {coinsNeeded} MORE
        </button>
      )}
    </div>
  );
}

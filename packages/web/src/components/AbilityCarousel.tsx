import { useEffect } from 'react';
import { useAbilityStore } from '../stores/abilityStore';
import type { Ability } from '@tetris-battle/game-core';
import type { Theme } from '../themes';

interface AbilityCarouselProps {
  currentStars: number;
  onActivate: (ability: Ability) => void;
  theme: Theme;
}

export function AbilityCarousel({ currentStars, onActivate, theme }: AbilityCarouselProps) {
  const {
    availableAbilities,
    refreshAbilities,
    canActivate,
    useAbility,
    getCooldownRemaining,
    isTestMode,
  } = useAbilityStore();

  // Auto-refresh abilities every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshAbilities();
    }, 10000);

    return () => clearInterval(interval);
  }, [refreshAbilities]);

  const handleActivate = (ability: Ability) => {
    if (canActivate(ability.id, currentStars)) {
      useAbility(ability.id);
      onActivate(ability);
    }
  };

  return (
    <div
      style={{
        backgroundColor: theme.uiBackgroundColor,
        padding: '10px',
        borderRadius: '5px',
      }}
    >
      <h4 style={{ margin: '0 0 10px 0', fontSize: '13px' }}>
        Abilities {isTestMode && '(TEST MODE - All 25 Available)'}
      </h4>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          maxHeight: isTestMode ? '400px' : 'none',
          overflowY: isTestMode ? 'auto' : 'visible',
        }}
      >
        {availableAbilities.map((ability, index) => {
          const canUse = canActivate(ability.id, currentStars);
          const cooldown = getCooldownRemaining(ability.id);
          const isOnCooldown = cooldown > 0;

          return (
            <button
              key={ability.id}
              onClick={() => handleActivate(ability)}
              disabled={!canUse || isOnCooldown}
              style={{
                padding: '8px',
                backgroundColor: canUse && !isOnCooldown
                  ? ability.category === 'buff'
                    ? theme.colors.T  // Purple for buffs
                    : ability.category === 'debuff'
                    ? theme.colors.Z  // Red for debuffs
                    : ability.category === 'defense'
                    ? theme.colors.I  // Blue for defense
                    : theme.colors.O  // Gold for ultra
                  : '#3a3a3a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: canUse && !isOnCooldown ? 'pointer' : 'not-allowed',
                textAlign: 'left',
                opacity: canUse && !isOnCooldown ? 1 : 0.5,
                transition: 'opacity 0.2s',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '2px' }}>
                    {index + 1}. {ability.name}
                  </div>
                  <div style={{ fontSize: '10px', opacity: 0.8 }}>
                    {ability.description}
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginLeft: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
                    {ability.cost} ⭐
                  </div>
                  {isOnCooldown && (
                    <div style={{ fontSize: '10px', opacity: 0.8 }}>
                      {Math.ceil(cooldown / 1000)}s
                    </div>
                  )}
                </div>
              </div>

              {/* Cooldown overlay */}
              {isOnCooldown && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    backgroundColor: theme.colors.I,
                    transformOrigin: 'left',
                    animation: `shrink ${ability.cooldown}ms linear`,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      <style>
        {`
          @keyframes shrink {
            from { transform: scaleX(1); }
            to { transform: scaleX(0); }
          }
        `}
      </style>

      <div style={{ marginTop: '8px', fontSize: '10px', opacity: 0.7, textAlign: 'center' }}>
        {isTestMode
          ? 'Click to activate (no cooldowns in test mode)'
          : 'Press 1, 2, or 3 to activate'}
      </div>
    </div>
  );
}

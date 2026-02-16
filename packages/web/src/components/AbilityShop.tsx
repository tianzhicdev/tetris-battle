import { useState } from 'react';
import { ABILITIES } from '@tetris-battle/game-core';
import { ABILITY_UNLOCKS } from '@tetris-battle/game-core';
import type { UserProfile } from '@tetris-battle/game-core';
import { progressionService } from '../lib/supabase';
import { AbilityCopy } from './AbilityCopy';

interface AbilityShopProps {
  profile: UserProfile;
  onClose: () => void;
  onProfileUpdate: (profile: UserProfile) => void;
}

export function AbilityShop({ profile, onClose, onProfileUpdate }: AbilityShopProps) {
  const [selectedAbility, setSelectedAbility] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);


  const handleUnlock = async (abilityId: string, cost: number) => {
    if (unlocking) return;

    setUnlocking(true);

    const newProfile = await progressionService.unlockAbility(profile.userId, abilityId, cost);

    if (newProfile) {
      onProfileUpdate(newProfile);
    }

    setUnlocking(false);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.92)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: 'clamp(10px, 2vw, 20px)',
    }}>
      <div style={{
        background: 'rgba(10, 10, 30, 0.95)',
        backdropFilter: 'blur(30px)',
        border: '1px solid rgba(0, 255, 136, 0.3)',
        borderRadius: 'clamp(12px, 3vw, 16px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        maxWidth: 'min(900px, 100%)',
        width: '100%',
        maxHeight: '95vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: 'clamp(15px, 4vw, 20px)',
          borderBottom: '1px solid rgba(0, 255, 136, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'clamp(10px, 2vw, 15px)',
        }}>
          <h2 style={{
            margin: 0,
            color: '#00ff88',
            fontSize: 'clamp(20px, 5vw, 28px)',
            fontWeight: '700',
            textShadow: '0 0 15px rgba(0, 255, 136, 0.6)',
          }}>
            ABILITY SHOP
          </h2>

          <div style={{ display: 'flex', gap: 'clamp(12px, 3vw, 20px)', alignItems: 'center' }}>
            <div style={{
              background: 'rgba(255, 170, 0, 0.1)',
              border: '1px solid rgba(255, 170, 0, 0.3)',
              borderRadius: 'clamp(6px, 1.5vw, 8px)',
              padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px)',
              color: '#ffd700',
              fontSize: 'clamp(16px, 4vw, 20px)',
              fontWeight: '700',
              boxShadow: '0 0 15px rgba(255, 170, 0, 0.2)',
            }}>
              {profile.coins} 🪙
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(10, 10, 30, 0.6)',
                backdropFilter: 'blur(20px)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px)',
                borderRadius: 'clamp(6px, 1.5vw, 8px)',
                cursor: 'pointer',
                fontSize: 'clamp(14px, 3.5vw, 16px)',
                fontWeight: '600',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Abilities List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'clamp(15px, 4vw, 20px)',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(250px, 100%), 1fr))',
            gap: 'clamp(10px, 2.5vw, 12px)',
          }}>
            {ABILITY_UNLOCKS.map(unlock => {
                    const ability = Object.values(ABILITIES).find((a: any) => a.type === unlock.abilityId);
                    if (!ability) return null;

                    const isUnlocked = profile.unlockedAbilities.includes(unlock.abilityId);
                    const canAfford = profile.coins >= unlock.cost;
                    const canUnlock = !isUnlocked && canAfford;
                    const inLoadout = profile.loadout.includes(unlock.abilityId);

                    return (
                      <div
                        key={unlock.abilityId}
                        onClick={() => setSelectedAbility(unlock.abilityId)}
                        style={{
                          background: selectedAbility === unlock.abilityId
                            ? 'rgba(10, 10, 30, 0.8)'
                            : 'rgba(10, 10, 30, 0.6)',
                          backdropFilter: 'blur(20px)',
                          border: `1px solid ${isUnlocked ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 255, 255, 0.15)'}`,
                          borderRadius: 'clamp(6px, 1.5vw, 8px)',
                          padding: 'clamp(10px, 2.5vw, 12px)',
                          cursor: 'pointer',
                          opacity: 1,
                          boxShadow: selectedAbility === unlock.abilityId
                            ? '0 4px 20px rgba(0, 255, 136, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                            : '0 2px 10px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: 'clamp(8px, 2vw, 10px)',
                          gap: 'clamp(6px, 1.5vw, 8px)',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <AbilityCopy
                              ability={ability}
                              accentColor={ability.category === 'buff' ? '#00d4ff' : '#ff006e'}
                              compact
                            />
                          </div>

                          {isUnlocked && inLoadout && (
                            <div style={{
                              background: 'rgba(0, 255, 136, 0.2)',
                              backdropFilter: 'blur(10px)',
                              color: '#00ff88',
                              border: '1px solid rgba(0, 255, 136, 0.4)',
                              padding: 'clamp(2px, 0.5vw, 3px) clamp(6px, 1.5vw, 8px)',
                              borderRadius: 'clamp(3px, 0.75vw, 4px)',
                              fontSize: 'clamp(9px, 2.25vw, 10px)',
                              fontWeight: '700',
                              boxShadow: '0 0 10px rgba(0, 255, 136, 0.3)',
                              whiteSpace: 'nowrap',
                            }}>
                              EQUIPPED
                            </div>
                          )}
                        </div>

                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 'clamp(8px, 2vw, 10px)',
                        }}>
                          {isUnlocked ? (
                            <div style={{
                              color: '#00ff88',
                              fontSize: 'clamp(11px, 2.75vw, 12px)',
                              fontWeight: '700',
                              textShadow: '0 0 8px rgba(0, 255, 136, 0.4)',
                            }}>
                              UNLOCKED ✓
                            </div>
                          ) : (
                            <div style={{
                              color: '#ffd700',
                              fontSize: 'clamp(13px, 3.25vw, 14px)',
                              fontWeight: '600',
                            }}>
                              🪙 {unlock.cost}
                            </div>
                          )}

                          {!isUnlocked && canUnlock && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlock(unlock.abilityId, unlock.cost);
                              }}
                              disabled={unlocking}
                              style={{
                                background: 'rgba(0, 255, 136, 0.2)',
                                backdropFilter: 'blur(10px)',
                                color: '#00ff88',
                                border: '1px solid rgba(0, 255, 136, 0.4)',
                                padding: 'clamp(4px, 1vw, 6px) clamp(10px, 2.5vw, 12px)',
                                borderRadius: 'clamp(4px, 1vw, 5px)',
                                cursor: unlocking ? 'wait' : 'pointer',
                                fontSize: 'clamp(11px, 2.75vw, 12px)',
                                fontWeight: '700',
                                boxShadow: '0 2px 10px rgba(0, 255, 136, 0.3)',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              {unlocking ? 'Unlocking...' : 'Unlock'}
                            </button>
                          )}

                          {!isUnlocked && !canUnlock && (
                            <div style={{
                              color: '#ff6e6e',
                              fontSize: 'clamp(10px, 2.5vw, 11px)',
                              fontWeight: '600',
                            }}>
                              Not enough coins
                            </div>
                          )}

                          {!isUnlocked && false && (
                            <div style={{
                              color: '#888',
                              fontSize: 'clamp(10px, 2.5vw, 11px)',
                              fontWeight: '600',
                            }}>
                              Level {unlock.level} required
                            </div>
                          )}
                        </div>
                      </div>
                    );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

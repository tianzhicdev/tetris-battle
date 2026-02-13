import { useState } from 'react';
import { ABILITIES } from '@tetris-battle/game-core';
import { ABILITY_UNLOCKS, canUnlockAbility } from '@tetris-battle/game-core';
import type { UserProfile } from '@tetris-battle/game-core';
import { progressionService } from '../lib/supabase';

interface AbilityShopProps {
  profile: UserProfile;
  onClose: () => void;
  onProfileUpdate: (profile: UserProfile) => void;
}

export function AbilityShop({ profile, onClose, onProfileUpdate }: AbilityShopProps) {
  const [selectedAbility, setSelectedAbility] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const stages = [
    { name: 'Rookie', levels: '1-5', minLevel: 1 },
    { name: 'Contender', levels: '6-10', minLevel: 6 },
    { name: 'Challenger', levels: '11-15', minLevel: 11 },
    { name: 'Veteran', levels: '16-20', minLevel: 16 },
    { name: 'Master', levels: '21-25', minLevel: 21 },
  ];

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
      background: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      fontFamily: 'monospace',
      padding: '10px',
    }}>
      <div style={{
        background: '#1a1a1a',
        border: '3px solid #00ff00',
        borderRadius: '12px',
        maxWidth: '900px',
        width: '100%',
        maxHeight: '95vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '2px solid #00ff00',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, color: '#00ff00', fontSize: '28px' }}>
            Ability Shop
          </h2>

          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{ color: '#ffaa00', fontSize: '20px' }}>
              🪙 {profile.coins}
            </div>
            <button
              onClick={onClose}
              style={{
                background: '#ff0000',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Abilities List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
        }}>
          {stages.map(stage => {
            const stageAbilities = ABILITY_UNLOCKS.filter(
              unlock => unlock.level >= stage.minLevel && unlock.level < (stage.minLevel + 5)
            );

            if (stageAbilities.length === 0) return null;

            const isLocked = profile.level < stage.minLevel;

            return (
              <div key={stage.name} style={{ marginBottom: '30px' }}>
                <h3 style={{
                  color: isLocked ? '#666' : '#00ffff',
                  marginBottom: '15px',
                  fontSize: '20px',
                }}>
                  {stage.name} (Levels {stage.levels}) {isLocked && '🔒'}
                </h3>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(250px, 100%), 1fr))',
                  gap: '12px',
                }}>
                  {stageAbilities.map(unlock => {
                    const ability = Object.values(ABILITIES).find((a: any) => a.type === unlock.abilityId);
                    if (!ability) return null;

                    const isUnlocked = profile.unlockedAbilities.includes(unlock.abilityId);
                    const canUnlock = canUnlockAbility(unlock.abilityId, profile.level, profile.coins, profile.unlockedAbilities);
                    const inLoadout = profile.loadout.includes(unlock.abilityId);

                    return (
                      <div
                        key={unlock.abilityId}
                        onClick={() => setSelectedAbility(unlock.abilityId)}
                        style={{
                          background: selectedAbility === unlock.abilityId ? '#2a2a2a' : '#1a1a1a',
                          border: `2px solid ${isUnlocked ? '#00ff00' : '#666'}`,
                          borderRadius: '8px',
                          padding: '12px',
                          cursor: 'pointer',
                          opacity: isLocked ? 0.5 : 1,
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                        }}>
                          <div style={{
                            color: '#00ff00',
                            fontWeight: 'bold',
                            fontSize: '14px',
                          }}>
                            {ability.name}
                          </div>

                          {isUnlocked && inLoadout && (
                            <div style={{
                              background: '#00ff00',
                              color: '#000',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 'bold',
                            }}>
                              EQUIPPED
                            </div>
                          )}
                        </div>

                        <div style={{
                          fontSize: '11px',
                          color: '#aaa',
                          marginBottom: '10px',
                          lineHeight: '1.4',
                        }}>
                          {ability.description}
                        </div>

                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}>
                          {isUnlocked ? (
                            <div style={{
                              color: '#00ff00',
                              fontSize: '12px',
                              fontWeight: 'bold',
                            }}>
                              UNLOCKED ✓
                            </div>
                          ) : (
                            <div style={{
                              color: '#ffaa00',
                              fontSize: '14px',
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
                                background: '#00ff00',
                                color: '#000',
                                border: 'none',
                                padding: '4px 12px',
                                borderRadius: '4px',
                                cursor: unlocking ? 'wait' : 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold',
                              }}
                            >
                              {unlocking ? 'Unlocking...' : 'Unlock'}
                            </button>
                          )}

                          {!isUnlocked && !canUnlock && profile.level >= unlock.level && (
                            <div style={{
                              color: '#ff0000',
                              fontSize: '11px',
                            }}>
                              Not enough coins
                            </div>
                          )}

                          {!isUnlocked && profile.level < unlock.level && (
                            <div style={{
                              color: '#666',
                              fontSize: '11px',
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
            );
          })}
        </div>
      </div>
    </div>
  );
}

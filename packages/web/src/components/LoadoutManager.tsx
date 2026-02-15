import { useState } from 'react';
import { ABILITIES } from '@tetris-battle/game-core';
import type { UserProfile } from '@tetris-battle/game-core';
import { progressionService } from '../lib/supabase';

interface LoadoutManagerProps {
  profile: UserProfile;
  onClose: () => void;
  onProfileUpdate: (profile: UserProfile) => void;
}

export function LoadoutManager({ profile, onClose, onProfileUpdate }: LoadoutManagerProps) {
  const [loadout, setLoadout] = useState<string[]>([...profile.loadout]);
  const [saving, setSaving] = useState(false);

  const maxSlots = 6; // Everyone gets 6 loadout slots

  const handleToggleAbility = (abilityId: string) => {
    if (loadout.includes(abilityId)) {
      // Remove from loadout
      setLoadout(loadout.filter(id => id !== abilityId));
    } else {
      // Add to loadout if there's space
      if (loadout.length < maxSlots) {
        setLoadout([...loadout, abilityId]);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);

    const success = await progressionService.updateLoadout(profile.userId, loadout);

    if (success) {
      onProfileUpdate({ ...profile, loadout });
      onClose();
    }

    setSaving(false);
  };

  const hasChanges = JSON.stringify(loadout) !== JSON.stringify(profile.loadout);

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
        maxWidth: 'min(800px, 100%)',
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
        }}>
          <h2 style={{ margin: '0 0 clamp(8px, 2vw, 10px) 0', color: '#00ff88', fontSize: 'clamp(22px, 5.5vw, 28px)', fontWeight: '700', textShadow: '0 0 15px rgba(0, 255, 136, 0.6)' }}>
            Loadout Manager
          </h2>
          <div style={{ color: '#aaa', fontSize: 'clamp(12px, 3vw, 14px)' }}>
            Select up to {maxSlots} abilities for battle
          </div>
        </div>

        {/* Loadout Slots */}
        <div style={{
          padding: 'clamp(15px, 4vw, 20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <div style={{
            color: '#00d4ff',
            marginBottom: 'clamp(8px, 2vw, 10px)',
            fontSize: 'clamp(14px, 3.5vw, 16px)',
            fontWeight: '700',
            textShadow: '0 0 10px rgba(0, 212, 255, 0.5)',
          }}>
            Active Loadout ({loadout.length}/{maxSlots})
          </div>

          <div style={{
            display: 'flex',
            gap: 'clamp(8px, 2vw, 10px)',
            flexWrap: 'wrap',
          }}>
            {Array.from({ length: maxSlots }).map((_, i) => {
              const abilityId = loadout[i];
              const ability = abilityId ? Object.values(ABILITIES).find((a: any) => a.type === abilityId) : null;

              return (
                <div
                  key={i}
                  style={{
                    flex: '1 1 clamp(120px, 30vw, 150px)',
                    minHeight: 'clamp(70px, 17.5vw, 80px)',
                    background: ability ? 'rgba(10, 10, 30, 0.7)' : 'rgba(10, 10, 30, 0.3)',
                    backdropFilter: 'blur(15px)',
                    border: `1px dashed ${ability ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 255, 255, 0.15)'}`,
                    borderRadius: 'clamp(6px, 1.5vw, 8px)',
                    padding: 'clamp(8px, 2vw, 10px)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    boxShadow: ability ? '0 2px 10px rgba(0, 255, 136, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)' : 'inset 0 1px 0 rgba(255, 255, 255, 0.02)',
                  }}
                >
                  {ability ? (
                    <>
                      <div style={{
                        color: '#00ff88',
                        fontSize: 'clamp(12px, 3vw, 14px)',
                        fontWeight: '700',
                        marginBottom: 'clamp(4px, 1vw, 5px)',
                        textAlign: 'center',
                        textShadow: '0 0 8px rgba(0, 255, 136, 0.4)',
                      }}>
                        {ability.name}
                      </div>
                      <div style={{
                        color: '#ffd700',
                        fontSize: 'clamp(10px, 2.5vw, 11px)',
                        fontWeight: '600',
                      }}>
                        {ability.cost} ⭐
                      </div>
                    </>
                  ) : (
                    <div style={{ color: '#555', fontSize: 'clamp(11px, 2.75vw, 12px)', fontWeight: '600' }}>
                      Empty Slot
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Available Abilities */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'clamp(15px, 4vw, 20px)',
        }}>
          <div style={{
            color: '#00d4ff',
            marginBottom: 'clamp(12px, 3vw, 15px)',
            fontSize: 'clamp(14px, 3.5vw, 16px)',
            fontWeight: '700',
            textShadow: '0 0 10px rgba(0, 212, 255, 0.5)',
          }}>
            Unlocked Abilities
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(180px, 100%), 1fr))',
            gap: 'clamp(10px, 2.5vw, 12px)',
          }}>
            {profile.unlockedAbilities.map(abilityId => {
              const ability = Object.values(ABILITIES).find((a: any) => a.type === abilityId);
              if (!ability) return null;

              const inLoadout = loadout.includes(abilityId);

              return (
                <div
                  key={abilityId}
                  onClick={() => handleToggleAbility(abilityId)}
                  style={{
                    background: inLoadout ? 'rgba(10, 10, 30, 0.8)' : 'rgba(10, 10, 30, 0.6)',
                    backdropFilter: 'blur(20px)',
                    border: `1px solid ${inLoadout ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 255, 255, 0.15)'}`,
                    borderRadius: 'clamp(6px, 1.5vw, 8px)',
                    padding: 'clamp(10px, 2.5vw, 12px)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: inLoadout
                      ? '0 4px 20px rgba(0, 255, 136, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                      : '0 2px 10px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'clamp(5px, 1.25vw, 6px)',
                    gap: 'clamp(6px, 1.5vw, 8px)',
                  }}>
                    <div style={{
                      color: '#00ff88',
                      fontSize: 'clamp(12px, 3vw, 14px)',
                      fontWeight: '700',
                      textShadow: inLoadout ? '0 0 10px rgba(0, 255, 136, 0.5)' : 'none',
                    }}>
                      {ability.name}
                    </div>

                    {inLoadout && (
                      <div style={{
                        color: '#00ff88',
                        fontSize: 'clamp(14px, 3.5vw, 16px)',
                        textShadow: '0 0 10px rgba(0, 255, 136, 0.6)',
                      }}>
                        ✓
                      </div>
                    )}
                  </div>

                  <div style={{
                    fontSize: 'clamp(10px, 2.5vw, 11px)',
                    color: '#aaa',
                    marginBottom: 'clamp(6px, 1.5vw, 8px)',
                    lineHeight: '1.4',
                  }}>
                    {ability.description}
                  </div>

                  <div style={{
                    fontSize: 'clamp(11px, 2.75vw, 12px)',
                    color: '#888',
                    fontWeight: '600',
                  }}>
                    {ability.cost} ⭐ | {ability.category}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: 'clamp(15px, 4vw, 20px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          gap: 'clamp(8px, 2vw, 10px)',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: 'clamp(10px, 2.5vw, 12px) clamp(20px, 5vw, 24px)',
              background: 'rgba(10, 10, 30, 0.6)',
              backdropFilter: 'blur(20px)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 'clamp(5px, 1.25vw, 6px)',
              cursor: 'pointer',
              fontSize: 'clamp(14px, 3.5vw, 16px)',
              fontWeight: '600',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.2s ease',
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            style={{
              padding: 'clamp(10px, 2.5vw, 12px) clamp(20px, 5vw, 24px)',
              background: hasChanges ? 'rgba(0, 255, 136, 0.2)' : 'rgba(10, 10, 30, 0.6)',
              backdropFilter: 'blur(20px)',
              color: hasChanges ? '#00ff88' : '#666',
              border: `1px solid ${hasChanges ? 'rgba(0, 255, 136, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: 'clamp(5px, 1.25vw, 6px)',
              cursor: hasChanges && !saving ? 'pointer' : 'not-allowed',
              fontSize: 'clamp(14px, 3.5vw, 16px)',
              fontWeight: '700',
              boxShadow: hasChanges ? '0 4px 20px rgba(0, 255, 136, 0.3)' : '0 2px 10px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.2s ease',
            }}
          >
            {saving ? 'Saving...' : 'Save Loadout'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { ABILITIES, getLoadoutSlots } from '@tetris-battle/game-core';
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

  const maxSlots = getLoadoutSlots(profile.level);

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
        maxWidth: '800px',
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
        }}>
          <h2 style={{ margin: '0 0 10px 0', color: '#00ff00', fontSize: '28px' }}>
            Loadout Manager
          </h2>
          <div style={{ color: '#aaa', fontSize: '14px' }}>
            Select up to {maxSlots} abilities for battle
          </div>
        </div>

        {/* Loadout Slots */}
        <div style={{
          padding: '20px',
          borderBottom: '2px solid #333',
        }}>
          <div style={{
            color: '#00ffff',
            marginBottom: '10px',
            fontSize: '16px',
          }}>
            Active Loadout ({loadout.length}/{maxSlots})
          </div>

          <div style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
          }}>
            {Array.from({ length: maxSlots }).map((_, i) => {
              const abilityId = loadout[i];
              const ability = abilityId ? Object.values(ABILITIES).find((a: any) => a.type === abilityId) : null;

              return (
                <div
                  key={i}
                  style={{
                    flex: '1 1 150px',
                    minHeight: '80px',
                    background: ability ? '#2a2a2a' : '#111',
                    border: `2px dashed ${ability ? '#00ff00' : '#444'}`,
                    borderRadius: '8px',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  {ability ? (
                    <>
                      <div style={{
                        color: '#00ff00',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        marginBottom: '5px',
                      }}>
                        {ability.name}
                      </div>
                      <div style={{
                        color: '#888',
                        fontSize: '11px',
                      }}>
                        {ability.cost} ⭐
                      </div>
                    </>
                  ) : (
                    <div style={{ color: '#444', fontSize: '12px' }}>
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
          padding: '20px',
        }}>
          <div style={{
            color: '#00ffff',
            marginBottom: '15px',
            fontSize: '16px',
          }}>
            Unlocked Abilities
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '12px',
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
                    background: inLoadout ? '#2a4a2a' : '#1a1a1a',
                    border: `2px solid ${inLoadout ? '#00ff00' : '#444'}`,
                    borderRadius: '8px',
                    padding: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}>
                    <div style={{
                      color: '#00ff00',
                      fontSize: '14px',
                      fontWeight: 'bold',
                    }}>
                      {ability.name}
                    </div>

                    {inLoadout && (
                      <div style={{
                        color: '#00ff00',
                        fontSize: '16px',
                      }}>
                        ✓
                      </div>
                    )}
                  </div>

                  <div style={{
                    fontSize: '11px',
                    color: '#aaa',
                    marginBottom: '8px',
                  }}>
                    {ability.description}
                  </div>

                  <div style={{
                    fontSize: '12px',
                    color: '#888',
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
          padding: '20px',
          borderTop: '2px solid #333',
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              background: '#444',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            style={{
              padding: '12px 24px',
              background: hasChanges ? '#00ff00' : '#444',
              color: hasChanges ? '#000' : '#666',
              border: 'none',
              borderRadius: '6px',
              cursor: hasChanges && !saving ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            {saving ? 'Saving...' : 'Save Loadout'}
          </button>
        </div>
      </div>
    </div>
  );
}

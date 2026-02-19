import { useState } from 'react';
import { ABILITIES, isDebuffAbility } from '@tetris-battle/game-core';
import { ABILITY_UNLOCKS } from '@tetris-battle/game-core';
import type { UserProfile } from '@tetris-battle/game-core';
import { progressionService } from '../lib/supabase';
import { AbilityCard } from './AbilityCard';

interface AbilityManagerProps {
  profile: UserProfile;
  onClose: () => void;
  onProfileUpdate: (profile: UserProfile) => void;
}

export function AbilityManager({ profile, onClose, onProfileUpdate }: AbilityManagerProps) {
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const maxSlots = 6;

  const handleBuy = async (abilityId: string, cost: number) => {
    if (buyingId) return;
    setBuyingId(abilityId);
    const newProfile = await progressionService.unlockAbility(profile.userId, abilityId, cost);
    if (newProfile) {
      onProfileUpdate(newProfile);
    }
    setBuyingId(null);
  };

  const handleEquip = async (abilityId: string) => {
    if (profile.loadout.length >= maxSlots) return;
    const newLoadout = [...profile.loadout, abilityId];
    const success = await progressionService.updateLoadout(profile.userId, newLoadout);
    if (success) {
      onProfileUpdate({ ...profile, loadout: newLoadout });
    }
  };

  const handleUnequip = async (abilityId: string) => {
    const newLoadout = profile.loadout.filter(id => id !== abilityId);
    const success = await progressionService.updateLoadout(profile.userId, newLoadout);
    if (success) {
      onProfileUpdate({ ...profile, loadout: newLoadout });
    }
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
      paddingTop: 'max(clamp(10px, 2vw, 20px), env(safe-area-inset-top))',
      paddingBottom: 'max(clamp(10px, 2vw, 20px), env(safe-area-inset-bottom))',
      paddingLeft: 'clamp(10px, 2vw, 20px)',
      paddingRight: 'clamp(10px, 2vw, 20px)',
    }}>
      <div style={{
        background: 'rgba(10, 10, 30, 0.95)',
        border: '1px solid rgba(0, 255, 136, 0.3)',
        borderRadius: 'clamp(12px, 3vw, 16px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        maxWidth: 'min(900px, 100%)',
        width: '100%',
        maxHeight: 'min(92dvh, 920px)',
        display: 'grid',
        gridTemplateRows: 'auto auto minmax(0, 1fr)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: 'clamp(12px, 3vw, 16px) clamp(15px, 4vw, 20px)',
          borderBottom: '1px solid rgba(0, 255, 136, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'clamp(10px, 2vw, 15px)',
          flexWrap: 'wrap',
        }}>
          <h2 style={{
            margin: 0,
            color: '#00ff88',
            fontSize: 'clamp(20px, 5vw, 26px)',
            fontWeight: 700,
            textShadow: '0 0 15px rgba(0, 255, 136, 0.6)',
          }}>
            ABILITIES
          </h2>
          <div style={{ display: 'flex', gap: 'clamp(10px, 2.5vw, 16px)', alignItems: 'center' }}>
            <div style={{
              background: 'rgba(255, 170, 0, 0.1)',
              border: '1px solid rgba(255, 170, 0, 0.3)',
              borderRadius: 'clamp(6px, 1.5vw, 8px)',
              padding: 'clamp(4px, 1vw, 6px) clamp(10px, 2.5vw, 14px)',
              color: '#ffd700',
              fontSize: 'clamp(14px, 3.5vw, 18px)',
              fontWeight: 700,
            }}>
              {profile.coins} coins
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(10, 10, 30, 0.6)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: 'clamp(4px, 1vw, 6px) clamp(10px, 2.5vw, 14px)',
                borderRadius: 'clamp(6px, 1.5vw, 8px)',
                cursor: 'pointer',
                fontSize: 'clamp(14px, 3.5vw, 16px)',
                fontWeight: 600,
              }}
            >
              Done
            </button>
          </div>
        </div>

        {/* Loadout Bar */}
        <div style={{
          padding: 'clamp(8px, 2vw, 12px) clamp(15px, 4vw, 20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 'clamp(6px, 1.5vw, 10px)',
          flexWrap: 'wrap',
        }}>
          <span style={{
            color: '#aaa',
            fontSize: 'clamp(11px, 2.7vw, 13px)',
            fontWeight: 600,
            flexShrink: 0,
          }}>
            Loadout ({profile.loadout.length}/{maxSlots}):
          </span>
          {profile.loadout.length === 0 ? (
            <span style={{ color: '#555', fontSize: 'clamp(11px, 2.7vw, 12px)', fontStyle: 'italic' }}>
              No abilities equipped
            </span>
          ) : (
            profile.loadout.map(id => {
              const ability = ABILITIES[id];
              if (!ability) return null;
              const isDebuff = isDebuffAbility(ability);
              const color = isDebuff ? '#ff006e' : '#00d4ff';
              return (
                <span
                  key={id}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    border: `1px solid ${color}`,
                    color,
                    background: 'rgba(255, 255, 255, 0.04)',
                    fontSize: 'clamp(10px, 2.5vw, 11px)',
                    fontWeight: 800,
                    letterSpacing: '0.3px',
                  }}
                >
                  {ability.shortName}
                </span>
              );
            })
          )}
        </div>

        {/* Ability Cards Grid */}
        <div style={{
          minHeight: 0,
          overflowY: 'auto',
          padding: 'clamp(12px, 3vw, 16px) clamp(15px, 4vw, 20px)',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))',
            gap: 'clamp(8px, 2vw, 12px)',
          }}>
            {ABILITY_UNLOCKS.map(unlock => {
              const ability = ABILITIES[unlock.abilityId];
              if (!ability) return null;

              const isOwned = profile.unlockedAbilities.includes(unlock.abilityId);
              const isEquipped = profile.loadout.includes(unlock.abilityId);

              return (
                <AbilityCard
                  key={unlock.abilityId}
                  ability={ability}
                  isOwned={isOwned}
                  isEquipped={isEquipped}
                  unlockCost={unlock.cost}
                  coins={profile.coins}
                  onBuy={() => handleBuy(unlock.abilityId, unlock.cost)}
                  onEquip={() => handleEquip(unlock.abilityId)}
                  onUnequip={() => handleUnequip(unlock.abilityId)}
                  isBuying={buyingId === unlock.abilityId}
                  loadoutFull={profile.loadout.length >= maxSlots}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

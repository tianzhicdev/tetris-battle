import { useState, useEffect } from 'react';
import { UserButton } from '@clerk/clerk-react';
import { getLevelStage } from '@tetris-battle/game-core';
import type { UserProfile } from '@tetris-battle/game-core';
import { AbilityShop } from './AbilityShop';
import { LoadoutManager } from './LoadoutManager';
import { ProfilePage } from './ProfilePage';
import { AbilityInfo } from './AbilityInfo';
import { audioManager } from '../services/audioManager';
import { glassSuccess, glassGold, glassBlue, glassPurple, mergeGlass } from '../styles/glassUtils';

interface MainMenuProps {
  onSelectMode: (mode: 'solo' | 'multiplayer') => void;
  theme: any;
  profile: UserProfile;
  onProfileUpdate: (profile: UserProfile) => void;
}

export function MainMenu({ onSelectMode, theme, profile, onProfileUpdate }: MainMenuProps) {
  const [showShop, setShowShop] = useState(false);
  const [showLoadout, setShowLoadout] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAbilityInfo, setShowAbilityInfo] = useState(false);

  const stage = getLevelStage(profile.level);

  // Play menu music on mount
  useEffect(() => {
    audioManager.playMusic('menu_theme', true);

    return () => {
      audioManager.stopMusic(true);
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: theme.backgroundColor,
        color: theme.textColor,
        fontFamily: 'monospace',
        position: 'relative',
      }}
    >
      {/* Progression HUD - Top */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        right: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={mergeGlass(glassSuccess(), {
            padding: '8px 12px',
            borderRadius: '8px',
            minWidth: 'fit-content',
          })}>
            <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>
              {stage.toUpperCase()}
            </div>
            <div style={{ fontSize: '16px', color: '#00ff9d', fontWeight: 'bold', textShadow: '0 0 10px rgba(0, 255, 157, 0.5)' }}>
              Lv {profile.level}
            </div>
          </div>

          <div style={mergeGlass(glassGold(), {
            padding: '8px 12px',
            borderRadius: '8px',
            minWidth: 'fit-content',
          })}>
            <div style={{ fontSize: '18px', color: '#ffd700', fontWeight: 'bold', textShadow: '0 0 10px rgba(255, 215, 0, 0.5)' }}>
              🪙 {profile.coins}
            </div>
          </div>
        </div>

        <div style={mergeGlass(glassBlue(), {
          padding: '4px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        })}>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "width: 36px; height: 36px;",
              },
            }}
          />
        </div>
      </div>

      <h1
        style={{
          fontSize: 'clamp(2rem, 10vw, 4rem)',
          marginBottom: '2rem',
          textShadow: `3px 3px 0 ${theme.colors.I}`,
          padding: '0 20px',
          textAlign: 'center',
        }}
      >
        TETRIS BATTLE
      </h1>

      {/* Main Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px', padding: '0 20px', width: '100%', maxWidth: '400px' }}>
        <button
          onClick={() => {
            audioManager.playSfx('button_click');
            onSelectMode('multiplayer');
          }}
          className="glass-button"
          style={mergeGlass(glassPurple(), {
            padding: '20px 50px',
            fontSize: 'clamp(20px, 6vw, 28px)',
            color: '#ffffff',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            width: '100%',
            minHeight: '80px',
            borderRadius: '16px',
            textShadow: '0 0 20px rgba(201, 66, 255, 0.8)',
          })}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
          onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          PLAY NOW
        </button>
      </div>

      {/* Progression Buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', padding: '0 20px' }}>
        <button
          onClick={() => {
            audioManager.playSfx('button_click');
            setShowProfile(true);
          }}
          style={mergeGlass(glassBlue(), {
            padding: '12px 20px',
            fontSize: '14px',
            color: '#00d4ff',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            minWidth: '90px',
            touchAction: 'manipulation',
            borderRadius: '8px',
            textShadow: '0 0 10px rgba(0, 212, 255, 0.5)',
            transition: 'all 0.2s ease',
          })}
        >
          Profile
        </button>

        <button
          onClick={() => {
            audioManager.playSfx('button_click');
            setShowShop(true);
          }}
          style={mergeGlass(glassGold(), {
            padding: '12px 20px',
            fontSize: '14px',
            color: '#ffd700',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            minWidth: '90px',
            touchAction: 'manipulation',
            borderRadius: '8px',
            textShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
            transition: 'all 0.2s ease',
          })}
        >
          Shop
        </button>

        <button
          onClick={() => {
            audioManager.playSfx('button_click');
            setShowLoadout(true);
          }}
          style={mergeGlass(glassSuccess(), {
            padding: '12px 20px',
            fontSize: '14px',
            color: '#00ff88',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            minWidth: '90px',
            touchAction: 'manipulation',
            borderRadius: '8px',
            textShadow: '0 0 10px rgba(0, 255, 136, 0.5)',
            transition: 'all 0.2s ease',
          })}
        >
          Loadout
        </button>

        <button
          onClick={() => {
            audioManager.playSfx('button_click');
            setShowAbilityInfo(true);
          }}
          style={mergeGlass(glassPurple(), {
            padding: '12px 20px',
            fontSize: '14px',
            color: '#ff00ff',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            minWidth: '90px',
            touchAction: 'manipulation',
            borderRadius: '8px',
            textShadow: '0 0 10px rgba(255, 0, 255, 0.5)',
            transition: 'all 0.2s ease',
          })}
        >
          Abilities
        </button>
      </div>

      {/* Modals */}
      {showShop && (
        <AbilityShop
          profile={profile}
          onClose={() => setShowShop(false)}
          onProfileUpdate={onProfileUpdate}
        />
      )}

      {showLoadout && (
        <LoadoutManager
          profile={profile}
          onClose={() => setShowLoadout(false)}
          onProfileUpdate={onProfileUpdate}
        />
      )}

      {showProfile && (
        <ProfilePage
          profile={profile}
          onClose={() => setShowProfile(false)}
        />
      )}

      {showAbilityInfo && (
        <AbilityInfo onClose={() => setShowAbilityInfo(false)} />
      )}
    </div>
  );
}

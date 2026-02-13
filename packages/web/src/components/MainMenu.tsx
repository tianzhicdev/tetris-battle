import { useState, useEffect } from 'react';
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
            onSelectMode('solo');
          }}
          className="glass-button"
          style={mergeGlass(glassBlue(), {
            padding: '16px 40px',
            fontSize: 'clamp(18px, 5vw, 24px)',
            color: '#ffffff',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            width: '100%',
            minHeight: '60px',
            borderRadius: '12px',
            textShadow: '0 0 15px rgba(0, 212, 255, 0.8)',
          })}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
          onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          SOLO PLAY
        </button>

        <button
          onClick={() => {
            audioManager.playSfx('button_click');
            onSelectMode('multiplayer');
          }}
          className="glass-button"
          style={mergeGlass(glassPurple(), {
            padding: '16px 40px',
            fontSize: 'clamp(18px, 5vw, 24px)',
            color: '#ffffff',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            width: '100%',
            minHeight: '60px',
            borderRadius: '12px',
            textShadow: '0 0 15px rgba(201, 66, 255, 0.8)',
          })}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
          onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          MULTIPLAYER
        </button>
      </div>

      {/* Progression Buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', padding: '0 20px' }}>
        <button
          onClick={() => {
            audioManager.playSfx('button_click');
            setShowProfile(true);
          }}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            backgroundColor: '#00ffff',
            color: '#000',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            minWidth: '90px',
            touchAction: 'manipulation',
          }}
        >
          Profile
        </button>

        <button
          onClick={() => {
            audioManager.playSfx('button_click');
            setShowShop(true);
          }}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            backgroundColor: '#ffaa00',
            color: '#000',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            minWidth: '90px',
            touchAction: 'manipulation',
          }}
        >
          Shop
        </button>

        <button
          onClick={() => {
            audioManager.playSfx('button_click');
            setShowLoadout(true);
          }}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            backgroundColor: '#00ff00',
            color: '#000',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            minWidth: '90px',
            touchAction: 'manipulation',
          }}
        >
          Loadout
        </button>

        <button
          onClick={() => {
            audioManager.playSfx('button_click');
            setShowAbilityInfo(true);
          }}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            backgroundColor: '#ff00ff',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            minWidth: '90px',
            touchAction: 'manipulation',
          }}
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

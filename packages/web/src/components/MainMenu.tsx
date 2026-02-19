import { useState, useEffect } from 'react';
import { UserButton } from '@clerk/clerk-react';
import type { UserProfile } from '@tetris-battle/game-core';
import { AbilityManager } from './AbilityManager';
import { ProfilePage } from './ProfilePage';
import { FriendList } from './FriendList';
import { FloatingBackground } from './FloatingBackground';
import { audioManager } from '../services/audioManager';
import { useFriendStore } from '../stores/friendStore';
import { glassSuccess, glassBlue, glassPurple, mergeGlass } from '../styles/glassUtils';

interface MainMenuProps {
  onSelectMode: (mode: 'solo' | 'multiplayer') => void;
  theme: any;
  profile: UserProfile;
  onProfileUpdate: (profile: UserProfile) => void;
  onChallenge?: (friendUserId: string, friendUsername: string) => void;
}

export function MainMenu({ onSelectMode, theme, profile, onProfileUpdate, onChallenge }: MainMenuProps) {
  const [showAbilities, setShowAbilities] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const pendingRequests = useFriendStore(state => state.pendingRequests);
  const topInset = 'max(10px, env(safe-area-inset-top))';
  const bottomInset = 'max(10px, env(safe-area-inset-bottom))';

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
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
        width: '100vw',
        height: '100dvh',
        minHeight: '100vh',
        backgroundColor: theme.backgroundColor,
        color: theme.textColor,
        fontFamily: 'monospace',
        position: 'relative',
        overflow: 'hidden',
        paddingTop: topInset,
        paddingBottom: bottomInset,
        paddingLeft: 'clamp(10px, 3vw, 20px)',
        paddingRight: 'clamp(10px, 3vw, 20px)',
      }}
    >
      <FloatingBackground />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          alignItems: 'center',
          minHeight: 'clamp(44px, 7vh, 56px)',
          width: '100%',
          maxWidth: 'min(820px, 100%)',
          justifySelf: 'center',
        }}
      >
        <div />
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
                avatarBox: 'width: 36px; height: 36px;',
              },
            }}
          />
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          minHeight: 0,
          display: 'grid',
          alignContent: 'center',
          justifyItems: 'center',
          gap: 'clamp(16px, 3.8vh, 30px)',
          width: '100%',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(2rem, 10vw, 4rem)',
            margin: 0,
            textShadow: `3px 3px 0 ${theme.colors.I}`,
            textAlign: 'center',
            width: '100%',
            maxWidth: 'min(820px, 100%)',
          }}
        >
          TETRIS BATTLE
        </h1>

        {/* Main Actions */}
        <div
          style={{
            display: 'grid',
            gap: '15px',
            width: '100%',
            maxWidth: '400px',
          }}
        >
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
      </div>

      {/* Progression Buttons */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          width: '100%',
          maxWidth: 'min(820px, 100%)',
          justifySelf: 'center',
          paddingBottom: 'clamp(2px, 0.6vh, 8px)',
        }}
      >
        <button
          onClick={() => {
            audioManager.playSfx('button_click');
            setShowFriends(true);
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
            position: 'relative' as const,
          })}
        >
          Friends
          {pendingRequests.length > 0 && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#ff006e',
              color: '#fff',
              borderRadius: '10px',
              padding: '1px 5px',
              fontSize: '10px',
              fontWeight: 'bold',
              minWidth: '16px',
              textAlign: 'center',
            }}>
              {pendingRequests.length}
            </span>
          )}
        </button>

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
            setShowAbilities(true);
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
          Abilities
        </button>
      </div>

      {/* Modals */}
      {showAbilities && (
        <AbilityManager
          profile={profile}
          onClose={() => setShowAbilities(false)}
          onProfileUpdate={onProfileUpdate}
        />
      )}

      {showProfile && (
        <ProfilePage
          profile={profile}
          onClose={() => setShowProfile(false)}
        />
      )}

      {showFriends && (
        <FriendList
          profile={profile}
          onClose={() => setShowFriends(false)}
          onChallenge={(friendUserId, friendUsername) => {
            setShowFriends(false);
            onChallenge?.(friendUserId, friendUsername);
          }}
        />
      )}
    </div>
  );
}

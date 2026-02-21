import { useState, useEffect } from 'react';
import { UserButton } from '@clerk/clerk-react';
import type { UserProfile } from '@tetris-battle/game-core';
import { AbilityManager } from './AbilityManager';
import { ProfilePage } from './ProfilePage';
import { FriendList } from './FriendList';
import { FloatingBackground } from './FloatingBackground';
import { audioManager } from '../services/audioManager';
import { useFriendStore } from '../stores/friendStore';
import { T } from '../design-tokens';

interface MainMenuProps {
  onSelectMode: (mode: 'solo' | 'multiplayer' | 'defense-line') => void;
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
        minHeight: '100vh',
        height: '100dvh',
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
        overflow: 'hidden',
        paddingTop: 'max(10px, env(safe-area-inset-top))',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        paddingLeft: 'clamp(10px, 3vw, 24px)',
        paddingRight: 'clamp(10px, 3vw, 24px)',
        backgroundColor: theme.backgroundColor,
        color: theme.textColor,
        fontFamily: T.font.body,
        position: 'relative',
      }}
    >
      <FloatingBackground />

      {/* User Button Row */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        justifyContent: 'flex-end',
      }}>
        <div style={{
          padding: '4px',
          borderRadius: '50%',
          background: `${T.accent.cyan}11`,
          border: `1px solid ${T.accent.cyan}33`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: T.glow(T.accent.cyan, 0.3),
        }}>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "width: 36px; height: 36px;",
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
          overflowY: 'auto',
          display: 'grid',
          justifyItems: 'center',
          alignContent: 'center',
          gap: 'clamp(14px, 3vh, 24px)',
          padding: 'clamp(8px, 2vh, 18px) 0',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(2rem, 10vw, 4rem)',
            margin: 0,
            textShadow: `3px 3px 0 ${theme.colors.I}`,
            textAlign: 'center',
          }}
        >
          TETRIS BATTLE
        </h1>

        {/* Main Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '400px' }}>
          <button
            onClick={() => {
              audioManager.playSfx('button_click');
              onSelectMode('multiplayer');
            }}
            style={{
              padding: '20px 50px',
              fontSize: 'clamp(20px, 6vw, 28px)',
              color: T.accent.purple,
              cursor: 'pointer',
              fontFamily: T.font.display,
              fontWeight: 700,
              letterSpacing: '3px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              width: '100%',
              minHeight: '80px',
              borderRadius: `${T.radius.xl}px`,
              background: T.bg.button,
              border: `2px solid ${T.accent.purple}44`,
              boxShadow: T.glow(T.accent.purple, 0.8),
              textShadow: T.glow(T.accent.purple, 1.5),
              backdropFilter: 'blur(20px)',
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
            onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            PLAY NOW
          </button>

          <button
            onClick={() => {
              audioManager.playSfx('button_click');
              onSelectMode('defense-line');
            }}
            className="glass-button"
            style={mergeGlass(glassBlue(), {
              padding: '16px 42px',
              fontSize: 'clamp(18px, 5vw, 24px)',
              color: '#ffffff',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              transition: 'all 0.25s ease',
              width: '100%',
              minHeight: '68px',
              borderRadius: '14px',
              textShadow: '0 0 14px rgba(0, 212, 255, 0.65)',
            })}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
            onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            DEFENSE LINE
          </button>
        </div>
      </div>

      {/* Progression Buttons */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        justifyContent: 'center',
        paddingTop: 'clamp(8px, 1.8vh, 14px)',
      }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '560px' }}>
        <button
          onClick={() => {
            audioManager.playSfx('button_click');
            setShowFriends(true);
          }}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            color: T.accent.cyan,
            cursor: 'pointer',
            fontFamily: T.font.display,
            fontWeight: 700,
            letterSpacing: '1px',
            minWidth: '90px',
            touchAction: 'manipulation',
            borderRadius: `${T.radius.md}px`,
            background: T.bg.button,
            border: `1px solid ${T.accent.cyan}33`,
            boxShadow: T.glow(T.accent.cyan, 0.5),
            textShadow: T.glow(T.accent.cyan, 1),
            backdropFilter: 'blur(20px)',
            transition: 'all 0.2s ease',
            position: 'relative' as const,
          }}
        >
          Friends
          {pendingRequests.length > 0 && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: T.accent.pink,
              color: '#fff',
              borderRadius: '10px',
              padding: '1px 5px',
              fontSize: '10px',
              fontWeight: 700,
              minWidth: '16px',
              textAlign: 'center',
              boxShadow: T.glow(T.accent.pink, 0.8),
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
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            color: T.accent.cyan,
            cursor: 'pointer',
            fontFamily: T.font.display,
            fontWeight: 700,
            letterSpacing: '1px',
            minWidth: '90px',
            touchAction: 'manipulation',
            borderRadius: `${T.radius.md}px`,
            background: T.bg.button,
            border: `1px solid ${T.accent.cyan}33`,
            boxShadow: T.glow(T.accent.cyan, 0.5),
            textShadow: T.glow(T.accent.cyan, 1),
            backdropFilter: 'blur(20px)',
            transition: 'all 0.2s ease',
          }}
        >
          Profile
        </button>

        <button
          onClick={() => {
            audioManager.playSfx('button_click');
            setShowAbilities(true);
          }}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            color: T.accent.green,
            cursor: 'pointer',
            fontFamily: T.font.display,
            fontWeight: 700,
            letterSpacing: '1px',
            minWidth: '90px',
            touchAction: 'manipulation',
            borderRadius: `${T.radius.md}px`,
            background: T.bg.button,
            border: `1px solid ${T.accent.green}33`,
            boxShadow: T.glow(T.accent.green, 0.5),
            textShadow: T.glow(T.accent.green, 1),
            backdropFilter: 'blur(20px)',
            transition: 'all 0.2s ease',
          }}
        >
          Abilities
        </button>
        </div>
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

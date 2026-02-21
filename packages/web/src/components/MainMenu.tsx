import { useState, useEffect } from 'react';
import { UserButton } from '@clerk/clerk-react';
import type { UserProfile } from '@tetris-battle/game-core';
import { AbilityManager } from './AbilityManager';
import { ProfilePage } from './ProfilePage';
import { FriendList } from './FriendList';
import { FloatingBackground } from './FloatingBackground';
import { ModeMenuGroup } from './ModeMenuGroup';
import { audioManager } from '../services/audioManager';
import { useFriendStore } from '../stores/friendStore';
import { T } from '../design-tokens';

interface MainMenuProps {
  onSelectMode: (selection: { mode: 'multiplayer' | 'defense-line'; aiOpponent: boolean }) => void;
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
        gridTemplateRows: 'auto minmax(0, 1fr)',
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
          display: 'flex',
          justifyContent: 'center',
          padding: 'clamp(6px, 1.5vh, 14px) 0',
        }}
      >
        <div style={{
          width: '100%',
          maxWidth: '440px',
          margin: '0 auto',
          display: 'grid',
          justifyItems: 'center',
          alignContent: 'center',
          gap: 'clamp(8px, 1.6vh, 14px)',
        }}>
          <img
            src="/stackcraft2_logo.png"
            alt="Stackcraft 2"
            style={{
              width: 'clamp(220px, 62vw, 520px)',
              maxWidth: '100%',
              height: 'auto',
              objectFit: 'contain',
              filter: `drop-shadow(0 0 18px ${theme.colors.I}33)`,
              marginTop: '-8px',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />

          <ModeMenuGroup
            onSelectMode={(selection) => {
              audioManager.playSfx('button_click');
              onSelectMode(selection);
            }}
          />

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
            <button
              onClick={() => {
                audioManager.playSfx('button_click');
                setShowFriends(true);
              }}
              style={{
                padding: '10px 18px',
                fontSize: '13px',
                color: T.accent.cyan,
                cursor: 'pointer',
                fontFamily: T.font.display,
                fontWeight: 700,
                letterSpacing: '1px',
                minWidth: '88px',
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
                padding: '10px 18px',
                fontSize: '13px',
                color: T.accent.cyan,
                cursor: 'pointer',
                fontFamily: T.font.display,
                fontWeight: 700,
                letterSpacing: '1px',
                minWidth: '88px',
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
                padding: '10px 18px',
                fontSize: '13px',
                color: T.accent.green,
                cursor: 'pointer',
                fontFamily: T.font.display,
                fontWeight: 700,
                letterSpacing: '1px',
                minWidth: '88px',
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

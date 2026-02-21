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
  onSelectMode: (selection: { mode: 'solo' | 'multiplayer' | 'defense-line'; aiOpponent: boolean }) => void;
  theme: any;
  profile: UserProfile;
  onProfileUpdate: (profile: UserProfile) => void;
  onChallenge?: (friendUserId: string, friendUsername: string) => void;
}

export function MainMenu({ onSelectMode, theme, profile, onProfileUpdate, onChallenge }: MainMenuProps) {
  const [showAbilities, setShowAbilities] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [defenseMode, setDefenseMode] = useState(false);
  const [aiOpponent, setAIOpponent] = useState(false);
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
          display: 'grid',
          justifyItems: 'center',
          alignContent: 'start',
          gap: 'clamp(8px, 1.6vh, 14px)',
          padding: 'clamp(4px, 1.2vh, 12px) 0',
        }}
      >
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

        {/* Main Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '400px' }}>
          {/* Defense Mode Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '4px',
          }}>
            <span style={{
              fontSize: 'clamp(14px, 3.5vw, 16px)',
              color: defenseMode ? T.accent.cyan : T.text.secondary,
              fontFamily: T.font.display,
              fontWeight: 600,
              transition: 'color 0.3s ease',
            }}>
              Defense Line
            </span>
            <button
              onClick={() => {
                audioManager.playSfx('button_click');
                setDefenseMode(!defenseMode);
              }}
              style={{
                width: '56px',
                height: '30px',
                borderRadius: '15px',
                background: defenseMode ? T.accent.cyan : 'rgba(255, 255, 255, 0.15)',
                border: defenseMode ? `2px solid ${T.accent.cyan}` : '2px solid rgba(255, 255, 255, 0.3)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: defenseMode ? T.glow(T.accent.cyan, 0.6) : 'none',
                padding: 0,
              }}
            >
              <div style={{
                position: 'absolute',
                top: '2px',
                left: defenseMode ? 'calc(100% - 24px - 2px)' : '2px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: defenseMode ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              }} />
            </button>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '4px',
          }}>
            <span style={{
              fontSize: 'clamp(14px, 3.5vw, 16px)',
              color: aiOpponent ? T.accent.cyan : T.text.secondary,
              fontFamily: T.font.display,
              fontWeight: 600,
              transition: 'color 0.3s ease',
            }}>
              AI Opponent
            </span>
            <button
              onClick={() => {
                audioManager.playSfx('button_click');
                setAIOpponent(!aiOpponent);
              }}
              style={{
                width: '56px',
                height: '30px',
                borderRadius: '15px',
                background: aiOpponent ? T.accent.cyan : 'rgba(255, 255, 255, 0.15)',
                border: aiOpponent ? `2px solid ${T.accent.cyan}` : '2px solid rgba(255, 255, 255, 0.3)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: aiOpponent ? T.glow(T.accent.cyan, 0.6) : 'none',
                padding: 0,
              }}
            >
              <div style={{
                position: 'absolute',
                top: '2px',
                left: aiOpponent ? 'calc(100% - 24px - 2px)' : '2px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: aiOpponent ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              }} />
            </button>
          </div>

          <button
            onClick={() => {
              audioManager.playSfx('button_click');
              onSelectMode({
                mode: defenseMode ? 'defense-line' : 'multiplayer',
                aiOpponent,
              });
            }}
            style={{
              padding: '16px 36px',
              fontSize: 'clamp(18px, 5.4vw, 26px)',
              color: defenseMode ? T.accent.cyan : T.accent.purple,
              cursor: 'pointer',
              fontFamily: T.font.display,
              fontWeight: 700,
              letterSpacing: '3px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              width: '100%',
              minHeight: '70px',
              borderRadius: `${T.radius.xl}px`,
              background: T.bg.button,
              border: defenseMode ? `2px solid ${T.accent.cyan}44` : `2px solid ${T.accent.purple}44`,
              boxShadow: defenseMode ? T.glow(T.accent.cyan, 0.8) : T.glow(T.accent.purple, 0.8),
              textShadow: defenseMode ? T.glow(T.accent.cyan, 1.5) : T.glow(T.accent.purple, 1.5),
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

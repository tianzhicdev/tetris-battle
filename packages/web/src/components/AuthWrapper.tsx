import { useEffect, useState } from 'react';
import { useUser, SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react';
import { UsernameSetup } from './UsernameSetup';
import { progressionService } from '../lib/supabase';
import type { UserProfile } from '@tetris-battle/game-core';
import { FloatingBackground } from './FloatingBackground';
import { T } from '../design-tokens';

interface AuthWrapperProps {
  children: (profile: UserProfile) => React.ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { user } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [signInHover, setSignInHover] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    setLoading(true);

    const existingProfile = await progressionService.getUserProfile(user.id);

    if (existingProfile) {
      setProfile(existingProfile);
      setNeedsUsername(false);
    } else {
      setNeedsUsername(true);
    }

    setLoading(false);
  };

  const handleUsernameComplete = async () => {
    if (!user) return;

    // Reload profile after username is set
    const newProfile = await progressionService.getUserProfile(user.id);
    if (newProfile) {
      setProfile(newProfile);
      setNeedsUsername(false);
    }
  };

  return (
    <>
      <SignedOut>
        <div
          style={{
            width: '100vw',
            height: '100dvh',
            position: 'fixed',
            inset: 0,
            overflow: 'hidden',
            display: 'grid',
            justifyItems: 'center',
            alignContent: 'center',
            gap: '20px',
            padding: 'max(18px, env(safe-area-inset-top)) 16px max(18px, env(safe-area-inset-bottom))',
            background: `radial-gradient(circle at 22% 18%, ${T.accent.cyan}18 0%, transparent 45%), radial-gradient(circle at 78% 82%, ${T.accent.purple}1f 0%, transparent 48%), linear-gradient(150deg, #05060f 0%, #0b1022 55%, #080715 100%)`,
            fontFamily: T.font.body,
          }}
        >
          <FloatingBackground />
          <img
            src="/stackcraft2_logo.png"
            alt="Stackcraft 2"
            style={{
              position: 'relative',
              zIndex: 2,
              width: 'clamp(210px, 62vw, 420px)',
              maxWidth: '100%',
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 18px rgba(0, 240, 240, 0.18))',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />

          <SignInButton mode="modal">
            <button
              onPointerEnter={() => setSignInHover(true)}
              onPointerLeave={() => setSignInHover(false)}
              style={{
                position: 'relative',
                zIndex: 2,
                width: 'min(320px, 100%)',
                height: '52px',
                borderRadius: `${T.radius.lg}px`,
                border: `1px solid ${signInHover ? T.border.medium : T.border.subtle}`,
                background: signInHover
                  ? 'linear-gradient(135deg, rgba(0, 240, 240, 0.18) 0%, rgba(0, 240, 140, 0.12) 100%)'
                  : T.bg.button,
                color: T.text.primary,
                fontFamily: T.font.display,
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: T.transition.normal,
                boxShadow: signInHover ? T.glow(T.accent.cyan, 0.9) : T.glow(T.accent.cyan, 0.4),
                transform: signInHover ? 'translateY(-1px)' : 'translateY(0)',
              }}
            >
              Sign In
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {loading ? (
          <div
            style={{
              width: '100vw',
              height: '100dvh',
              position: 'fixed',
              inset: 0,
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              background: `radial-gradient(circle at 24% 15%, ${T.accent.cyan}14 0%, transparent 46%), linear-gradient(145deg, #060711 0%, #0d1330 62%, #090816 100%)`,
              fontFamily: T.font.body,
            }}
          >
            <FloatingBackground />
            <div
              style={{
                position: 'relative',
                zIndex: 2,
                border: `1px solid ${T.border.accent}`,
                borderRadius: `${T.radius.lg}px`,
                background: T.bg.panel,
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: `${T.shadow.md}, ${T.panelGlow}`,
                padding: '20px 28px',
                textAlign: 'center',
                minWidth: 'min(250px, 80vw)',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                  color: T.text.secondary,
                  marginBottom: '10px',
                }}
              >
                Syncing Profile
              </div>
              <div
                style={{
                  fontSize: 'clamp(20px, 5vw, 28px)',
                  fontWeight: 900,
                  color: T.accent.cyan,
                  textShadow: T.glow(T.accent.cyan, 1),
                  letterSpacing: '1px',
                }}
              >
                Loading...
              </div>
            </div>
          </div>
        ) : needsUsername && user ? (
          <UsernameSetup userId={user.id} onComplete={handleUsernameComplete} />
        ) : profile ? (
          <>
            {/* Render children with profile */}
            {children(profile)}
          </>
        ) : null}
      </SignedIn>
    </>
  );
}

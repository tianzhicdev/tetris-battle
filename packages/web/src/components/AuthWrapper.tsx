import { useEffect, useState } from 'react';
import { useUser, SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react';
import { UsernameSetup } from './UsernameSetup';
import { progressionService } from '../lib/supabase';
import type { UserProfile } from '@tetris-battle/game-core';

interface AuthWrapperProps {
  children: (profile: UserProfile) => React.ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { user } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);

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
        <div style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0e27 0%, #1a1433 100%)',
        }}>
          <div style={{
            background: 'rgba(10, 10, 30, 0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: '24px',
            padding: '60px 80px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: '500px',
            width: '90%',
          }}>
            <h1 style={{
              fontSize: 'clamp(36px, 8vw, 56px)',
              marginBottom: '40px',
              fontWeight: '800',
              background: 'linear-gradient(135deg, #00d4ff 0%, #00ff88 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textAlign: 'center',
              letterSpacing: '2px',
              textShadow: '0 0 40px rgba(0, 212, 255, 0.5)',
            }}>
              TETRIS BATTLE
            </h1>

            <SignInButton mode="modal">
              <button style={{
                padding: '16px 48px',
                background: 'linear-gradient(135deg, #00d4ff 0%, #00ff88 100%)',
                color: '#000',
                fontSize: '18px',
                fontWeight: '700',
                borderRadius: '12px',
                cursor: 'pointer',
                border: 'none',
                boxShadow: '0 4px 15px rgba(0, 212, 255, 0.4)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 212, 255, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 212, 255, 0.4)';
              }}>
                Sign In / Sign Up
              </button>
            </SignInButton>

            <div style={{
              marginTop: '32px',
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.6)',
              textAlign: 'center',
              lineHeight: '1.6',
            }}>
              Sign in with Google, Apple, or Email
              <br />
              to start playing and track your progress
            </div>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        {loading ? (
          <div style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0a0e27 0%, #1a1433 100%)',
          }}>
            <div style={{
              fontSize: '24px',
              color: '#00d4ff',
              fontWeight: '600',
              textShadow: '0 0 20px rgba(0, 212, 255, 0.6)',
            }}>
              Loading...
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

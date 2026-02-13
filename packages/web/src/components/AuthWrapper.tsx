import { useEffect, useState } from 'react';
import { useUser, SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
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
          background: '#000',
          color: '#00ff00',
        }}>
          <h1 style={{
            fontSize: '48px',
            marginBottom: '40px',
            fontFamily: 'monospace',
          }}>
            TETRIS BATTLE
          </h1>

          <div style={{
            padding: '20px 40px',
            background: '#00ff00',
            color: '#000',
            fontSize: '18px',
            fontWeight: 'bold',
            borderRadius: '8px',
            cursor: 'pointer',
          }}>
            <SignInButton mode="modal">
              Sign In / Sign Up
            </SignInButton>
          </div>

          <div style={{
            marginTop: '40px',
            fontSize: '14px',
            color: '#888',
            textAlign: 'center',
            maxWidth: '400px',
          }}>
            Sign in with Google or Apple to start playing and track your progress
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
            background: '#000',
            color: '#00ff00',
            fontSize: '24px',
          }}>
            Loading...
          </div>
        ) : needsUsername && user ? (
          <UsernameSetup userId={user.id} onComplete={handleUsernameComplete} />
        ) : profile ? (
          <>
            {/* User button in top-right */}
            <div style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              zIndex: 100,
            }}>
              <UserButton />
            </div>

            {/* Render children with profile */}
            {children(profile)}
          </>
        ) : null}
      </SignedIn>
    </>
  );
}

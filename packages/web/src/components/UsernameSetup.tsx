import { useState } from 'react';
import { progressionService } from '../lib/supabase';

interface UsernameSetupProps {
  userId: string;
  onComplete: () => void;
}

export function UsernameSetup({ userId, onComplete }: UsernameSetupProps) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate username
    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (username.length > 20) {
      setError('Username must be less than 20 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username can only contain letters, numbers, and underscores');
      return;
    }

    setLoading(true);

    try {
      const profile = await progressionService.createUserProfile(userId, username);

      if (!profile) {
        setError('Failed to create profile. Username might be taken.');
        setLoading(false);
        return;
      }

      onComplete();
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#1a1a1a',
        padding: '40px',
        borderRadius: '12px',
        border: '2px solid #00ff00',
        maxWidth: '400px',
        width: '90%',
      }}>
        <h2 style={{
          color: '#00ff00',
          marginTop: 0,
          marginBottom: '20px',
          textAlign: 'center',
        }}>
          Choose Your Username
        </h2>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username..."
            autoFocus
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              background: '#000',
              border: '2px solid #00ff00',
              borderRadius: '6px',
              color: '#00ff00',
              marginBottom: '12px',
              fontFamily: 'monospace',
            }}
          />

          {error && (
            <div style={{
              color: '#ff0000',
              marginBottom: '12px',
              fontSize: '14px',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              background: '#00ff00',
              border: 'none',
              borderRadius: '6px',
              color: '#000',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Creating...' : 'Start Playing'}
          </button>
        </form>

        <div style={{
          marginTop: '20px',
          fontSize: '12px',
          color: '#888',
          textAlign: 'center',
        }}>
          3-20 characters | Letters, numbers, and underscores only
        </div>
      </div>
    </div>
  );
}

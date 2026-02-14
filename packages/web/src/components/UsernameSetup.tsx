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
      background: 'linear-gradient(135deg, #0a0e27 0%, #1a1433 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'rgba(10, 10, 30, 0.6)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 212, 255, 0.3)',
        borderRadius: '20px',
        padding: '48px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        maxWidth: '500px',
        width: '90%',
      }}>
        <h2 style={{
          color: '#00d4ff',
          marginTop: 0,
          marginBottom: '32px',
          textAlign: 'center',
          fontSize: '28px',
          fontWeight: '700',
          textShadow: '0 0 20px rgba(0, 212, 255, 0.6)',
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
              padding: '16px',
              fontSize: '16px',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: '12px',
              color: '#ffffff',
              marginBottom: '16px',
              outline: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.6)';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 212, 255, 0.3)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.3)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />

          {error && (
            <div style={{
              color: '#ff006e',
              marginBottom: '16px',
              fontSize: '14px',
              padding: '12px',
              background: 'rgba(255, 0, 110, 0.1)',
              border: '1px solid rgba(255, 0, 110, 0.3)',
              borderRadius: '8px',
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '18px',
              background: loading ? 'rgba(0, 212, 255, 0.5)' : 'linear-gradient(135deg, #00d4ff 0%, #00ff88 100%)',
              border: 'none',
              borderRadius: '12px',
              color: '#000',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 15px rgba(0, 212, 255, 0.4)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 212, 255, 0.6)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 212, 255, 0.4)';
              }
            }}
          >
            {loading ? 'Creating...' : 'Start Playing'}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          fontSize: '13px',
          color: 'rgba(255, 255, 255, 0.5)',
          textAlign: 'center',
          lineHeight: '1.6',
        }}>
          3-20 characters • Letters, numbers, and underscores only
        </div>
      </div>
    </div>
  );
}

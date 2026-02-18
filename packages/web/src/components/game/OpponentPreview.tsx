import { type RefObject } from 'react';

interface OpponentPreviewProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  score: number;
  stars: number;
  defensiveAbility: 'reflect' | 'shield' | null;
}

export function OpponentPreview({ canvasRef, score, stars, defensiveAbility }: OpponentPreviewProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        padding: '6px',
        borderRadius: '10px',
        background: 'rgba(18, 8, 20, 0.58)',
        border: '1px solid rgba(255, 0, 110, 0.24)',
        backdropFilter: 'blur(14px)',
        position: 'relative',
      }}
    >
      {defensiveAbility && (
        <div
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            fontSize: '10px',
            color: defensiveAbility === 'reflect' ? '#c942ff' : '#ff5ca1',
            fontWeight: 700,
          }}
        >
          {defensiveAbility === 'reflect' ? '🪞' : '🛡️'}
        </div>
      )}
      <div
        style={{
          width: '100%',
          maxWidth: '78px',
          aspectRatio: '1 / 2',
        }}
      >
        <canvas
          ref={canvasRef}
          width={80}
          height={160}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '6px',
            border: '1px solid rgba(255, 0, 110, 0.55)',
            backgroundColor: 'rgba(5, 5, 15, 0.8)',
            boxShadow: '0 0 10px rgba(255, 0, 110, 0.28)',
          }}
        />
      </div>
      <div style={{ fontSize: '9px', color: '#ff8eb8', textAlign: 'center', lineHeight: 1.25 }}>
        <div>{score}</div>
        <div style={{ color: '#ff66cc' }}>⭐ {stars}</div>
      </div>
    </div>
  );
}

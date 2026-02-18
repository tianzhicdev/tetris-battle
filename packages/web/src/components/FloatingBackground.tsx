import { useMemo } from 'react';

const ORBS = [
  { size: 300, color: 'rgba(201, 66, 255, 0.08)', x: '10%', y: '20%', duration: 25, delay: 0 },
  { size: 250, color: 'rgba(0, 212, 255, 0.07)', x: '70%', y: '60%', duration: 30, delay: -5 },
  { size: 200, color: 'rgba(0, 255, 136, 0.06)', x: '80%', y: '10%', duration: 35, delay: -10 },
  { size: 350, color: 'rgba(255, 215, 0, 0.05)', x: '20%', y: '70%', duration: 28, delay: -15 },
  { size: 180, color: 'rgba(255, 0, 110, 0.06)', x: '50%', y: '40%', duration: 32, delay: -8 },
];

export function FloatingBackground() {
  const keyframesId = useMemo(() => `float-${Math.random().toString(36).slice(2, 6)}`, []);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <style>{`
        @keyframes ${keyframesId}-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -40px) scale(1.05); }
          50% { transform: translate(-20px, 20px) scale(0.95); }
          75% { transform: translate(15px, 35px) scale(1.02); }
        }
        @keyframes ${keyframesId}-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .floating-orb { animation: none !important; }
        }
      `}</style>
      {ORBS.map((orb, i) => (
        <div
          key={i}
          className="floating-orb"
          style={{
            position: 'absolute',
            left: orb.x,
            top: orb.y,
            width: orb.size,
            height: orb.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
            filter: 'blur(40px)',
            animation: `${keyframesId}-drift ${orb.duration}s ease-in-out infinite, ${keyframesId}-pulse ${orb.duration * 0.8}s ease-in-out infinite`,
            animationDelay: `${orb.delay}s, ${orb.delay * 0.7}s`,
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </div>
  );
}

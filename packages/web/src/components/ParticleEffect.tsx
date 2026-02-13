import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
}

interface ParticleEffectProps {
  x: number; // Screen x position
  y: number; // Screen y position
  count?: number;
  colors?: string[];
  onComplete?: () => void;
}

export function ParticleEffect({ x, y, count = 30, colors = ['#00d4ff', '#c942ff', '#ff006e', '#00ff88', '#ffa500'], onComplete }: ParticleEffectProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Generate particles
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 2 + Math.random() * 4;
      newParticles.push({
        id: i,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 8,
      });
    }
    setParticles(newParticles);

    // Clean up after animation
    const timeout = setTimeout(() => {
      onComplete?.();
    }, 1000);

    return () => clearTimeout(timeout);
  }, [x, y, count]);

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{
            x: particle.x,
            y: particle.y,
            scale: 1,
            opacity: 1,
          }}
          animate={{
            x: particle.x + particle.vx * 100,
            y: particle.y + particle.vy * 100,
            scale: 0,
            opacity: 0,
          }}
          transition={{
            duration: 1,
            ease: 'easeOut',
          }}
          style={{
            position: 'absolute',
            width: particle.size,
            height: particle.size,
            borderRadius: '50%',
            backgroundColor: particle.color,
            boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
          }}
        />
      ))}
    </div>
  );
}

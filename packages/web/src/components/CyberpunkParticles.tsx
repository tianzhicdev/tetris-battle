import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

type ParticleType = 'burst' | 'trail' | 'lock' | 'ambient' | 'lineSweep';

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  decay: number;
  size: number;
  type: ParticleType;

  constructor(x: number, y: number, color: string, type: ParticleType) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.type = type;

    if (type === 'burst') {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 5;
      this.vx = Math.cos(a) * sp;
      this.vy = Math.sin(a) * sp - 2;
      this.life = 1;
      this.decay = 0.014 + Math.random() * 0.02;
      this.size = 2 + Math.random() * 4;
    } else if (type === 'trail') {
      this.vx = (Math.random() - 0.5) * 0.6;
      this.vy = -0.8 - Math.random() * 1.5;
      this.life = 1;
      this.decay = 0.04 + Math.random() * 0.03;
      this.size = 1.5 + Math.random() * 2.5;
    } else if (type === 'ambient') {
      this.vx = (Math.random() - 0.5) * 0.12;
      this.vy = -0.08 - Math.random() * 0.15;
      this.life = 0.4 + Math.random() * 0.3;
      this.decay = 0.001 + Math.random() * 0.002;
      this.size = 0.8 + Math.random() * 1.2;
    } else if (type === 'lock') {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.3 + Math.random() * 1.2;
      this.vx = Math.cos(a) * sp;
      this.vy = Math.sin(a) * sp;
      this.life = 1;
      this.decay = 0.035 + Math.random() * 0.025;
      this.size = 1 + Math.random() * 2;
    } else if (type === 'lineSweep') {
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = -0.3 - Math.random() * 0.4;
      this.life = 1;
      this.decay = 0.008 + Math.random() * 0.008;
      this.size = 1 + Math.random() * 1.5;
    } else {
      // Default fallback
      this.vx = 0;
      this.vy = 0;
      this.life = 1;
      this.decay = 0.01;
      this.size = 2;
    }
  }

  update(): boolean {
    this.x += this.vx;
    this.y += this.vy;
    if (this.type === 'burst') this.vy += 0.14; // gravity
    if (this.type === 'lock') {
      this.vx *= 0.95;
      this.vy *= 0.95;
    }
    this.life -= this.decay;
    return this.life > 0;
  }
}

interface CyberpunkParticlesProps {
  width: number;
  height: number;
}

export interface CyberpunkParticlesHandle {
  addParticles(x: number, y: number, color: string, count: number, type: ParticleType): void;
}

export const CyberpunkParticles = forwardRef<CyberpunkParticlesHandle, CyberpunkParticlesProps>(
  ({ width, height }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const frameRef = useRef<number | null>(null);

    // addParticles function
    const addParticles = useCallback((x: number, y: number, color: string, count: number, type: ParticleType) => {
      for (let i = 0; i < count; i++) {
        particlesRef.current.push(new Particle(x, y, color, type));
      }
    }, []);

    // Expose via ref
    useImperativeHandle(ref, () => ({ addParticles }), [addParticles]);

    // Ambient particle spawner (every 200ms, max 120 particles)
    useEffect(() => {
      const interval = setInterval(() => {
        if (particlesRef.current.length < 120) {
          const hue = 180 + Math.random() * 40;
          addParticles(Math.random() * width, height + 5, `hsl(${hue}, 60%, 50%)`, 1, 'ambient');
        }
      }, 200);
      return () => clearInterval(interval);
    }, [width, height, addParticles]);

    // requestAnimationFrame loop
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      let running = true;

      const draw = () => {
        if (!running) return;
        ctx.clearRect(0, 0, width, height);

        particlesRef.current = particlesRef.current.filter((p) => {
          const alive = p.update();
          if (!alive) return false;

          ctx.globalAlpha = Math.min(p.life, 1) * (p.type === 'ambient' ? 0.6 : 1);
          ctx.shadowColor = p.color;
          ctx.shadowBlur = p.type === 'ambient' ? 3 : p.type === 'lineSweep' ? 8 : 10;
          ctx.fillStyle = p.color;

          if (p.type === 'burst') {
            const s = p.size * Math.max(p.life, 0.2);
            ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
          } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * Math.min(p.life + 0.3, 1), 0, Math.PI * 2);
            ctx.fill();
          }

          return true;
        });

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        frameRef.current = requestAnimationFrame(draw);
      };

      draw();
      return () => {
        running = false;
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
      };
    }, [width, height]);

    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 8,
          pointerEvents: 'none',
        }}
      />
    );
  }
);

CyberpunkParticles.displayName = 'CyberpunkParticles';

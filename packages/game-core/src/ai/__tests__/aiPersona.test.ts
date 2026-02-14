import { describe, it, expect } from 'vitest';
import { generateAIPersona } from '../aiPersona';

describe('AI Persona', () => {
  it('generates unique personas', () => {
    const personas = Array.from({ length: 100 }, () => generateAIPersona());
    const ids = personas.map(p => p.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(100);
  });

  it('ranks fall within difficulty ranges', () => {
    const personas = Array.from({ length: 100 }, () => generateAIPersona());

    personas.forEach(p => {
      if (p.difficulty === 'easy') {
        expect(p.rank).toBeGreaterThanOrEqual(200);
        expect(p.rank).toBeLessThanOrEqual(600);
      } else if (p.difficulty === 'medium') {
        expect(p.rank).toBeGreaterThanOrEqual(700);
        expect(p.rank).toBeLessThanOrEqual(1300);
      } else {
        expect(p.rank).toBeGreaterThanOrEqual(1400);
        expect(p.rank).toBeLessThanOrEqual(2200);
      }
    });
  });

  it('all personas have isBot flag', () => {
    const personas = Array.from({ length: 50 }, () => generateAIPersona());
    expect(personas.every(p => p.isBot === true)).toBe(true);
  });

  it('matches difficulty to target rank', () => {
    const persona = generateAIPersona(1000);
    expect(persona.difficulty).toBe('medium');
    expect(Math.abs(persona.rank - 1000)).toBeLessThanOrEqual(300);
  });

  it('generates low rank for easy difficulty when target is low', () => {
    const persona = generateAIPersona(400);
    expect(persona.difficulty).toBe('easy');
  });

  it('generates high rank for hard difficulty when target is high', () => {
    const persona = generateAIPersona(1800);
    expect(persona.difficulty).toBe('hard');
  });
});

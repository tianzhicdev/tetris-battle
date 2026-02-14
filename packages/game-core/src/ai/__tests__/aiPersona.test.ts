import { describe, it, expect } from 'vitest';
import { generateAIPersona } from '../aiPersona';

describe('AI Persona', () => {
  it('generates unique personas', () => {
    const personas = Array.from({ length: 100 }, () => generateAIPersona());
    const ids = personas.map(p => p.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(100);
  });

  it('generates rank near target rank', () => {
    const persona = generateAIPersona(1000);
    // Rank should be within ±100 of target
    expect(persona.rank).toBeGreaterThanOrEqual(900);
    expect(persona.rank).toBeLessThanOrEqual(1100);
  });

  it('generates default mid-range rank without target', () => {
    const personas = Array.from({ length: 100 }, () => generateAIPersona());

    personas.forEach(p => {
      expect(p.rank).toBeGreaterThanOrEqual(800);
      expect(p.rank).toBeLessThanOrEqual(1200);
    });
  });

  it('all personas have isBot flag', () => {
    const personas = Array.from({ length: 50 }, () => generateAIPersona());
    expect(personas.every(p => p.isBot === true)).toBe(true);
  });

  it('clamps rank to minimum of 200', () => {
    const persona = generateAIPersona(200);
    expect(persona.rank).toBeGreaterThanOrEqual(200);
  });

  it('generates rank near high target', () => {
    const persona = generateAIPersona(1800);
    expect(persona.rank).toBeGreaterThanOrEqual(1700);
    expect(persona.rank).toBeLessThanOrEqual(1900);
  });
});

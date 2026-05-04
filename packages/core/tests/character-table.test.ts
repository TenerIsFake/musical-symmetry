import { describe, it, expect } from 'vitest';
import { characterTableEntry } from '../src/character-table';
import type { PitchClass } from '../src/types';

describe('characterTableEntry', () => {
  it('diatonic: E=+1, T6=-1, I=+1, R=-1', () => {
    const entry = characterTableEntry([0,2,4,5,7,9,11] as PitchClass[]);
    expect(entry.E).toBe(1);
    expect(entry.T6).toBe(-1);
    expect(entry.I).toBe(1);
    expect(entry.R).toBe(-1);
  });
  it('whole-tone: all +1', () => {
    const entry = characterTableEntry([0,2,4,6,8,10] as PitchClass[]);
    expect(entry.E).toBe(1);
    expect(entry.T6).toBe(1);
    expect(entry.I).toBe(1);
    expect(entry.R).toBe(1);
  });
  it('harmonic minor: E=+1, T6=-1, I=-1, R=-1', () => {
    const entry = characterTableEntry([0,2,3,5,7,8,11] as PitchClass[]);
    expect(entry.E).toBe(1);
    expect(entry.T6).toBe(-1);
    expect(entry.I).toBe(-1);
    expect(entry.R).toBe(-1);
  });
  it('octatonic: E=+1, T6=+1, I=+1, R=-1', () => {
    const entry = characterTableEntry([0,1,3,4,6,7,9,10] as PitchClass[]);
    expect(entry.E).toBe(1);
    expect(entry.T6).toBe(1);
    expect(entry.I).toBe(1);
    expect(entry.R).toBe(-1);
  });
});

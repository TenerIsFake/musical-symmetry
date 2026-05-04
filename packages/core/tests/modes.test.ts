import { describe, it, expect } from 'vitest';
import { analyzeModes, isRetrogradePalindrome, brightnessIndex } from '../src/modes';
import type { PitchClass } from '../src/types';

const C_MAJOR: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];

describe('isRetrogradePalindrome', () => {
  it('whole-tone is palindromic', () => {
    expect(isRetrogradePalindrome([0,2,4,6,8,10] as PitchClass[])).toBe(true);
  });
  it('diminished 7th is palindromic', () => {
    expect(isRetrogradePalindrome([0,3,6,9] as PitchClass[])).toBe(true);
  });
  it('diatonic starting on C (Ionian) is NOT palindromic', () => {
    expect(isRetrogradePalindrome([0,2,4,5,7,9,11] as PitchClass[])).toBe(false);
  });
  it('harmonic minor is NOT palindromic', () => {
    expect(isRetrogradePalindrome([0,2,3,5,7,8,11] as PitchClass[])).toBe(false);
  });
});

describe('brightnessIndex', () => {
  it('Lydian = +3', () => {
    expect(brightnessIndex([0,2,4,6,7,9,11] as PitchClass[])).toBe(3);
  });
  it('Ionian = +2', () => {
    expect(brightnessIndex([0,2,4,5,7,9,11] as PitchClass[])).toBe(2);
  });
  it('Dorian = 0', () => {
    expect(brightnessIndex([0,2,3,5,7,9,10] as PitchClass[])).toBe(0);
  });
  it('Locrian = -3', () => {
    expect(brightnessIndex([0,1,3,5,6,8,10] as PitchClass[])).toBe(-3);
  });
});

describe('analyzeModes', () => {
  it('C major diatonic → 7 modes', () => {
    const modes = analyzeModes(C_MAJOR);
    expect(modes).toHaveLength(7);
  });
  it('finds Dorian as palindromic', () => {
    const modes = analyzeModes(C_MAJOR);
    const dorian = modes.find(m => m.name === 'Dorian');
    expect(dorian).toBeDefined();
    expect(dorian!.isPalindrome).toBe(true);
  });
  it('Lydian is brightest (+3)', () => {
    const modes = analyzeModes(C_MAJOR);
    const lydian = modes.find(m => m.name === 'Lydian');
    expect(lydian).toBeDefined();
    expect(lydian!.brightnessIndex).toBe(3);
  });
  it('only Dorian is palindromic', () => {
    const modes = analyzeModes(C_MAJOR);
    const palindromes = modes.filter(m => m.isPalindrome);
    expect(palindromes).toHaveLength(1);
    expect(palindromes[0]!.name).toBe('Dorian');
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseMusicXml } from '../src/parsers/musicxml.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, 'fixtures/c-major-triad.musicxml'), 'utf-8');

describe('parseMusicXml', () => {
  it('extracts notes from MusicXML', () => {
    const result = parseMusicXml(fixture);
    expect(result.notes).toHaveLength(4);
    expect(result.notes[0]!.pitchClass).toBe(0);
    expect(result.notes[1]!.pitchClass).toBe(4);
    expect(result.notes[2]!.pitchClass).toBe(7);
    expect(result.notes[3]!.pitchClass).toBe(0);
  });

  it('calculates sequential beat positions', () => {
    const result = parseMusicXml(fixture);
    expect(result.notes[0]!.startBeat).toBeCloseTo(0, 5);
    expect(result.notes[1]!.startBeat).toBeCloseTo(1, 5);
    expect(result.notes[2]!.startBeat).toBeCloseTo(2, 5);
    expect(result.notes[3]!.startBeat).toBeCloseTo(3, 5);
  });

  it('extracts time signature', () => {
    const result = parseMusicXml(fixture);
    expect(result.timeSignatures).toContain('4/4');
  });
});

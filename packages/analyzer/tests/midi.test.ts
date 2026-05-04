import { describe, it, expect } from 'vitest';
import { parseMidi } from '../src/parsers/midi.js';
import { writeMidi } from 'midi-file';

function buildMidiBuffer(): Buffer {
  const midi = {
    header: { format: 0 as const, numTracks: 1, ticksPerBeat: 480 },
    tracks: [[
      { type: 'setTempo' as const, deltaTime: 0, microsecondsPerBeat: 500000 },
      { type: 'timeSignature' as const, deltaTime: 0, numerator: 4, denominator: 4, metronome: 24, thirtyseconds: 8 },
      { type: 'noteOn' as const, deltaTime: 0, channel: 0, noteNumber: 60, velocity: 80 },
      { type: 'noteOff' as const, deltaTime: 480, channel: 0, noteNumber: 60, velocity: 0 },
      { type: 'noteOn' as const, deltaTime: 0, channel: 0, noteNumber: 64, velocity: 80 },
      { type: 'noteOff' as const, deltaTime: 480, channel: 0, noteNumber: 64, velocity: 0 },
      { type: 'noteOn' as const, deltaTime: 0, channel: 0, noteNumber: 67, velocity: 80 },
      { type: 'noteOff' as const, deltaTime: 480, channel: 0, noteNumber: 67, velocity: 0 },
      { type: 'endOfTrack' as const, deltaTime: 0 },
    ]],
  };

  const bytes = writeMidi(midi);
  return Buffer.from(bytes);
}

describe('parseMidi', () => {
  it('extracts TimedNotes from MIDI buffer', () => {
    const buf = buildMidiBuffer();
    const result = parseMidi(buf);
    expect(result.notes).toHaveLength(3);
    expect(result.notes[0]!.pitchClass).toBe(0);
    expect(result.notes[1]!.pitchClass).toBe(4);
    expect(result.notes[2]!.pitchClass).toBe(7);
  });

  it('calculates beat positions correctly', () => {
    const buf = buildMidiBuffer();
    const result = parseMidi(buf);
    expect(result.notes[0]!.startBeat).toBeCloseTo(0, 5);
    expect(result.notes[1]!.startBeat).toBeCloseTo(1, 5);
    expect(result.notes[2]!.startBeat).toBeCloseTo(2, 5);
  });

  it('extracts tempo and time signature', () => {
    const buf = buildMidiBuffer();
    const result = parseMidi(buf);
    expect(result.temposBPM).toContain(120);
    expect(result.timeSignatures).toContain('4/4');
  });
});

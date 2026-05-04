import { describe, it, expect } from 'vitest';
import { parseMidi } from '../src/parsers/midi.js';
import { parseMusicXml } from '../src/parsers/musicxml.js';
import { analyzeTimeline } from '../src/analyzer.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeMidi } from 'midi-file';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('end-to-end: MIDI → analysis', () => {
  it('analyzes a C major chord MIDI file', () => {
    const midi = {
      header: { format: 0 as const, numTracks: 1, ticksPerBeat: 480 },
      tracks: [[
        { type: 'setTempo' as const, deltaTime: 0, microsecondsPerBeat: 500000 },
        { type: 'timeSignature' as const, deltaTime: 0, numerator: 4, denominator: 4, metronome: 24, thirtyseconds: 8 },
        { type: 'noteOn' as const, deltaTime: 0, channel: 0, noteNumber: 60, velocity: 80 },
        { type: 'noteOn' as const, deltaTime: 0, channel: 0, noteNumber: 64, velocity: 80 },
        { type: 'noteOn' as const, deltaTime: 0, channel: 0, noteNumber: 67, velocity: 80 },
        { type: 'noteOff' as const, deltaTime: 480, channel: 0, noteNumber: 60, velocity: 0 },
        { type: 'noteOff' as const, deltaTime: 0, channel: 0, noteNumber: 64, velocity: 0 },
        { type: 'noteOff' as const, deltaTime: 0, channel: 0, noteNumber: 67, velocity: 0 },
        { type: 'endOfTrack' as const, deltaTime: 0 },
      ]],
    };

    const bytes = writeMidi(midi);
    const buffer = Buffer.from(bytes);
    const parsed = parseMidi(buffer);

    expect(parsed.notes).toHaveLength(3);

    const timeline = analyzeTimeline(parsed.notes, {
      sliceMode: 'beat',
      minNotesPerSlice: 3,
      totalBeats: 1,
      temposBPM: parsed.temposBPM,
      timeSignatures: parsed.timeSignatures,
      filename: 'test.mid',
      format: 'midi',
    });

    expect(timeline.slices).toHaveLength(1);
    expect(timeline.slices[0]!.analysis.intervalVector).toEqual([0, 0, 1, 1, 1, 0]);
    expect(timeline.slices[0]!.chord).not.toBeNull();
    expect(timeline.slices[0]!.chord!.quality).toBe('major');
  });
});

describe('end-to-end: MusicXML → analysis', () => {
  it('analyzes C major triad fixture', () => {
    const xml = readFileSync(join(__dirname, 'fixtures/c-major-triad.musicxml'), 'utf-8');
    const parsed = parseMusicXml(xml);

    const timeline = analyzeTimeline(parsed.notes, {
      sliceMode: 'measure',
      minNotesPerSlice: 2,
      totalBeats: 4,
      temposBPM: parsed.temposBPM,
      timeSignatures: parsed.timeSignatures,
      filename: 'c-major-triad.musicxml',
      format: 'musicxml',
    });

    expect(timeline.slices).toHaveLength(1);
    expect(timeline.slices[0]!.analysis.abstractGroup).toBeDefined();
    expect(timeline.format).toBe('musicxml');
  });
});

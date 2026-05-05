import { describe, it, expect } from 'vitest';
import { parseAudio } from '../src/parsers/audio.js';
import { parseWav } from '../src/parsers/wav.js';

function generateSineWave(frequency: number, durationSec: number, sampleRate: number = 44100): Float32Array {
  const numSamples = Math.floor(sampleRate * durationSec);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    samples[i] = 0.5 * Math.sin(2 * Math.PI * frequency * i / sampleRate);
  }
  return samples;
}

function createWavBuffer(samples: Float32Array, sampleRate: number = 44100): Buffer {
  const numSamples = samples.length;
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);       // chunk size
  buffer.writeUInt16LE(1, 20);        // PCM format
  buffer.writeUInt16LE(1, 22);        // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(bytesPerSample, 32);  // block align
  buffer.writeUInt16LE(16, 34);       // bits per sample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]!));
    buffer.writeInt16LE(Math.floor(val * 32767), 44 + i * 2);
  }

  return buffer;
}

describe('parseAudio', () => {
  it('detects A4 (440Hz) from sine wave', () => {
    const samples = generateSineWave(440, 0.5);
    const result = parseAudio(samples, 44100);
    expect(result.notes.length).toBeGreaterThan(0);
    // A4 = MIDI 69, pitchClass 9
    const pitchClasses = result.notes.map(n => n.pitchClass);
    expect(pitchClasses).toContain(9);
  });

  it('detects C4 (261.63Hz) from sine wave', () => {
    const samples = generateSineWave(261.63, 0.5);
    const result = parseAudio(samples, 44100);
    expect(result.notes.length).toBeGreaterThan(0);
    const pitchClasses = result.notes.map(n => n.pitchClass);
    expect(pitchClasses).toContain(0);
  });

  it('returns empty notes for silence', () => {
    const samples = new Float32Array(44100); // 1 second of silence
    const result = parseAudio(samples, 44100);
    expect(result.notes).toHaveLength(0);
  });
});

describe('parseWav', () => {
  it('parses WAV buffer and detects pitch', () => {
    const sine = generateSineWave(440, 0.5);
    const wav = createWavBuffer(sine);
    const result = parseWav(wav);
    expect(result.sampleRate).toBe(44100);
    expect(result.notes.length).toBeGreaterThan(0);
    expect(result.notes[0]!.pitchClass).toBe(9); // A
  });
});

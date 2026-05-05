import type { PitchClass } from '@musical-symmetry/core';
import type { TimedNote } from '../types.js';

export interface AudioParseResult {
  notes: TimedNote[];
  temposBPM: number[];
  timeSignatures: string[];
  sampleRate: number;
  durationSeconds: number;
}

const MIN_FREQUENCY = 65;   // C2
const MAX_FREQUENCY = 2093; // C7

function autoCorrelate(buffer: Float32Array, sampleRate: number): number | null {
  const SIZE = buffer.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i]! * buffer[i]!;
  rms = Math.sqrt(rms / SIZE);

  if (rms < 0.01) return null; // too quiet

  // Normalize
  const normalized = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) normalized[i] = buffer[i]!;

  // YIN-style difference function
  const maxLag = Math.floor(sampleRate / MIN_FREQUENCY);
  const minLag = Math.floor(sampleRate / MAX_FREQUENCY);
  const diff = new Float32Array(maxLag);

  for (let lag = minLag; lag < maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < SIZE - lag; i++) {
      const d = normalized[i]! - normalized[i + lag]!;
      sum += d * d;
    }
    diff[lag] = sum;
  }

  // Cumulative mean normalized difference
  const cmndf = new Float32Array(maxLag);
  cmndf[0] = 1;
  let runningSum = 0;
  for (let lag = minLag; lag < maxLag; lag++) {
    runningSum += diff[lag]!;
    cmndf[lag] = diff[lag]! * lag / runningSum;
  }

  // Find first dip below threshold
  const threshold = 0.15;
  let bestLag = -1;
  for (let lag = minLag; lag < maxLag - 1; lag++) {
    if (cmndf[lag]! < threshold) {
      // Find local minimum
      while (lag + 1 < maxLag && cmndf[lag + 1]! < cmndf[lag]!) lag++;
      bestLag = lag;
      break;
    }
  }

  if (bestLag === -1) return null;

  const frequency = sampleRate / bestLag;
  if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) return null;
  return frequency;
}

function frequencyToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

export function parseAudio(samples: Float32Array, sampleRate: number): AudioParseResult {
  const frameSize = 2048;
  const hopSize = 1024;
  const totalFrames = Math.floor((samples.length - frameSize) / hopSize);
  const bpm = 120;
  const beatsPerSecond = bpm / 60;

  const detections: { midi: number; startSec: number; }[] = [];

  for (let i = 0; i < totalFrames; i++) {
    const start = i * hopSize;
    const frame = samples.slice(start, start + frameSize);
    const freq = autoCorrelate(frame, sampleRate);
    if (freq !== null) {
      const midi = frequencyToMidi(freq);
      detections.push({ midi, startSec: start / sampleRate });
    }
  }

  // Group consecutive same-pitch detections into notes
  const notes: TimedNote[] = [];
  let currentNote: { midi: number; startSec: number; count: number } | null = null;

  for (const det of detections) {
    if (currentNote && currentNote.midi === det.midi) {
      currentNote.count++;
    } else {
      if (currentNote && currentNote.count >= 2) {
        const durationSec = (currentNote.count * hopSize) / sampleRate;
        notes.push({
          pitch: currentNote.midi,
          pitchClass: (currentNote.midi % 12) as PitchClass,
          startBeat: currentNote.startSec * beatsPerSecond,
          durationBeats: durationSec * beatsPerSecond,
          velocity: 80,
          channel: 0,
        });
      }
      currentNote = { midi: det.midi, startSec: det.startSec, count: 1 };
    }
  }

  // Flush last note
  if (currentNote && currentNote.count >= 2) {
    const durationSec = (currentNote.count * hopSize) / sampleRate;
    notes.push({
      pitch: currentNote.midi,
      pitchClass: (currentNote.midi % 12) as PitchClass,
      startBeat: currentNote.startSec * beatsPerSecond,
      durationBeats: durationSec * beatsPerSecond,
      velocity: 80,
      channel: 0,
    });
  }

  return {
    notes,
    temposBPM: [bpm],
    timeSignatures: ['4/4'],
    sampleRate,
    durationSeconds: samples.length / sampleRate,
  };
}

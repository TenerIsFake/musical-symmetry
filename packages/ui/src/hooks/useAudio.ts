import { useRef, useCallback } from 'react';
import * as Tone from 'tone';
import type { PitchClass } from '@musical-symmetry/core';

const PC_TO_NOTE: Record<number, string> = {
  0: 'C4', 1: 'C#4', 2: 'D4', 3: 'Eb4', 4: 'E4', 5: 'F4',
  6: 'F#4', 7: 'G4', 8: 'Ab4', 9: 'A4', 10: 'Bb4', 11: 'B4',
};

export function useAudio() {
  const synthRef = useRef<Tone.PolySynth | null>(null);

  const ensureSynth = useCallback(async () => {
    await Tone.start();
    if (!synthRef.current) {
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 },
      }).toDestination();
    }
    return synthRef.current;
  }, []);

  const playChord = useCallback(async (pcs: PitchClass[], duration = '2n') => {
    const synth = await ensureSynth();
    const notes = pcs.map(pc => PC_TO_NOTE[pc]!);
    synth.triggerAttackRelease(notes, duration);
  }, [ensureSynth]);

  const playArpeggio = useCallback(async (pcs: PitchClass[], noteLength = 0.3) => {
    const synth = await ensureSynth();
    const now = Tone.now();
    pcs.forEach((pc, i) => {
      synth.triggerAttackRelease(PC_TO_NOTE[pc]!, '8n', now + i * noteLength);
    });
  }, [ensureSynth]);

  const playProgression = useCallback(async (from: PitchClass[], to: PitchClass[]) => {
    const synth = await ensureSynth();
    const now = Tone.now();
    const fromNotes = from.map(pc => PC_TO_NOTE[pc]!);
    const toNotes = to.map(pc => PC_TO_NOTE[pc]!);
    synth.triggerAttackRelease(fromNotes, '2n', now);
    synth.triggerAttackRelease(toNotes, '2n', now + 1.2);
  }, [ensureSynth]);

  const stop = useCallback(() => {
    synthRef.current?.releaseAll();
  }, []);

  return { playChord, playArpeggio, playProgression, stop };
}

export function playPitchClasses(
  pcs: number[],
  mode: 'chord' | 'arpeggio' = 'chord',
  duration = 1.5
): void {
  const ctx = new AudioContext();
  const baseFreq = 261.63; // Middle C
  pcs.forEach((pc, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = baseFreq * Math.pow(2, pc / 12);
    gain.gain.value = 0.3 / pcs.length;
    osc.connect(gain).connect(ctx.destination);
    const startTime = mode === 'arpeggio' ? i * 0.3 : 0;
    osc.start(ctx.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + startTime + duration
    );
    osc.stop(ctx.currentTime + startTime + duration + 0.1);
  });
}

export function playChordProgression(chords: number[][], bpm: number = 120): void {
  const ctx = new AudioContext();
  const beatDuration = 60 / bpm;
  chords.forEach((pcs, chordIdx) => {
    pcs.forEach(pc => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 261.63 * Math.pow(2, pc / 12);
      gain.gain.value = 0.2 / pcs.length;
      osc.connect(gain).connect(ctx.destination);
      const start = ctx.currentTime + chordIdx * beatDuration;
      osc.start(start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + beatDuration * 0.9);
      osc.stop(start + beatDuration);
    });
  });
}

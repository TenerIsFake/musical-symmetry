export function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  // Autocorrelation method (McLeod Pitch Method simplified)
  // Returns frequency in Hz, or null if no clear pitch
  const SIZE = buffer.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);
  let bestOffset = -1;
  let bestCorrelation = 0;
  let foundGoodCorrelation = false;
  const correlations = new Float32Array(MAX_SAMPLES);

  for (let offset = 0; offset < MAX_SAMPLES; offset++) {
    let correlation = 0;
    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs(buffer[i]! - buffer[i + offset]!);
    }
    correlation = 1 - correlation / MAX_SAMPLES;
    correlations[offset] = correlation;

    if (correlation > 0.9 && correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
      foundGoodCorrelation = true;
    } else if (foundGoodCorrelation && correlation < 0.85) {
      break;
    }
  }

  if (bestCorrelation < 0.8 || bestOffset === -1) return null;
  return sampleRate / bestOffset;
}

export function frequencyToPitchClass(freq: number): number {
  // Convert frequency to pitch class (0-11)
  // A4 = 440Hz = pitch class 9
  const semitones = 12 * Math.log2(freq / 440);
  return ((Math.round(semitones) % 12) + 12 + 9) % 12;
}

export function frequencyToNoteName(freq: number): { note: string; octave: number; cents: number } {
  const noteNames = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  const semitones = 12 * Math.log2(freq / 440);
  const rounded = Math.round(semitones);
  const cents = Math.round((semitones - rounded) * 100);
  const noteIndex = ((rounded % 12) + 12 + 9) % 12;
  const octave = Math.floor((rounded + 9) / 12) + 4;
  return { note: noteNames[noteIndex]!, octave, cents };
}

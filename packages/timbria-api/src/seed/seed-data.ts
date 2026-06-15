import type { FxCategory } from '../types.js';

export const SEED_FX: Array<{ name: string; category: FxCategory; fingerprint: string; tells: string; era: string; typical_use: string }> = [
  { name: 'Plate Reverb', category: 'reverb', fingerprint: 'Dense, bright, smooth tail with no distinct echoes.', tells: 'Fast bright metallic-shimmer decay; sits behind the source.', era: '1957–', typical_use: 'Vocals, snare' },
  { name: 'Spring Reverb', category: 'reverb', fingerprint: 'Boingy, mid-focused, drippy.', tells: 'Characteristic "sproing" on transients.', era: '1960s–', typical_use: 'Surf guitar, dub' },
  { name: 'Hall Reverb', category: 'reverb', fingerprint: 'Long, diffuse, deep sense of space.', tells: 'Slow build, long wash, distant.', era: '—', typical_use: 'Orchestral, ambient' },
  { name: 'FET Compressor (1176-style)', category: 'dynamics', fingerprint: 'Fast, punchy, adds aggressive grab and color.', tells: 'Snappy transient control; "all-buttons" grit.', era: '1967–', typical_use: 'Vocals, drums, bass' },
  { name: 'Optical Compressor (LA-2A-style)', category: 'dynamics', fingerprint: 'Smooth, slow, musical level-riding.', tells: 'Gentle, transparent gain reduction.', era: '1965–', typical_use: 'Vocals, bass' },
  { name: 'Tape Saturation', category: 'distortion', fingerprint: 'Warm, gentle compression + harmonic thickening.', tells: 'Softened transients, subtle high-end roll-off.', era: '—', typical_use: 'Mix glue, drums' },
  { name: 'Analog Delay', category: 'delay', fingerprint: 'Warm, darkening repeats that degrade over time.', tells: 'Each echo duller than the last.', era: '1970s–', typical_use: 'Guitar, vocals, dub' },
  { name: 'Chorus', category: 'modulation', fingerprint: 'Shimmery thickening / doubling.', tells: 'Wobbly, wide, "underwater" sheen.', era: '1970s–', typical_use: '80s guitar, synths' },
  { name: 'Flanger', category: 'modulation', fingerprint: 'Jet-plane sweeping comb filter.', tells: 'Whooshing sweep through the spectrum.', era: '1960s–', typical_use: 'Guitar, drums' },
  { name: 'Parametric EQ', category: 'eq', fingerprint: 'Tonal sculpting; no obvious "effect".', tells: 'Inferred from spectral balance, not a sound itself.', era: '—', typical_use: 'Everything' },
  { name: 'Auto-Tune (audible)', category: 'pitch', fingerprint: 'Hard-quantized pitch with zero glide.', tells: 'Robotic instant note jumps.', era: '1998–', typical_use: 'Modern vocals' },
  { name: 'Analog Poly Synth', category: 'source-synth', fingerprint: 'Warm, slightly detuned, fat oscillators.', tells: 'Gentle pitch drift, lush unison.', era: '1978–', typical_use: 'Pads, leads' },
];

export const SEED_GEAR: Array<{ name: string; fxName: string; manufacturer: string; kind: string }> = [
  { name: 'EMT 140', fxName: 'Plate Reverb', manufacturer: 'EMT', kind: 'hardware' },
  { name: 'Universal Audio 1176LN', fxName: 'FET Compressor (1176-style)', manufacturer: 'Universal Audio', kind: 'hardware' },
  { name: 'Teletronix LA-2A', fxName: 'Optical Compressor (LA-2A-style)', manufacturer: 'Teletronix', kind: 'hardware' },
  { name: 'Roland Juno-106', fxName: 'Analog Poly Synth', manufacturer: 'Roland', kind: 'synth' },
  { name: 'Boss CE-1', fxName: 'Chorus', manufacturer: 'Boss', kind: 'hardware' },
  { name: 'Antares Auto-Tune', fxName: 'Auto-Tune (audible)', manufacturer: 'Antares', kind: 'plugin' },
];

export const SEED_SOUNDS: Array<{ name: string; description: string; chainFxNames: string[] }> = [
  { name: '80s gated-reverb snare', description: 'Huge snare with an abruptly cut reverb tail.', chainFxNames: ['Plate Reverb', 'Parametric EQ'] },
  { name: 'Dub delay throw', description: 'A word/snare flung into degrading echoes.', chainFxNames: ['Analog Delay', 'Spring Reverb'] },
  { name: 'Modern pop vocal', description: 'Up-front, pitch-perfect, tightly controlled vocal.', chainFxNames: ['Auto-Tune (audible)', 'FET Compressor (1176-style)', 'Plate Reverb'] },
];

export const SEED_IDENTIFY: Array<{ key: string; question: string; branches: Array<{ answer: string; next: string }>; leafFxNames: string[]; explanation: string }> = [
  { key: 'root', question: 'Is there an obvious sense of space/ambience, or is it a pitched/tonal effect?', branches: [{ answer: 'space/ambience', next: 'space' }, { answer: 'pitched/tonal', next: 'tonal' }], leafFxNames: [], explanation: '' },
  { key: 'space', question: 'Short & metallic, or long & washy?', branches: [{ answer: 'short metallic', next: 'plate' }, { answer: 'long washy', next: 'hall' }], leafFxNames: [], explanation: '' },
  { key: 'plate', question: '', branches: [], leafFxNames: ['Plate Reverb'], explanation: 'Fast bright metallic decay with no distinct echoes points to a plate reverb.' },
  { key: 'hall', question: '', branches: [], leafFxNames: ['Hall Reverb'], explanation: 'A long, slow, diffuse wash points to a hall reverb.' },
  { key: 'tonal', question: '', branches: [], leafFxNames: ['Chorus'], explanation: 'Shimmery wobble/doubling without added space points to a chorus.' },
];

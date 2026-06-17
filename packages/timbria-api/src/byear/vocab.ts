export const INSTRUMENT_LABELS = [
  'Electric guitar', 'Acoustic guitar', 'Bass guitar', 'Upright bass',
  'Acoustic piano', 'Electric piano', 'Organ', 'Synth lead', 'Synth pad/bass',
  'Acoustic kit', 'Electronic/drum machine', 'Percussion', 'Vocals',
  'Strings', 'Brass', 'Saxophone', 'Woodwinds', 'Banjo/mandolin', 'Other',
] as const;

export const EFFECT_LABELS = [
  'Reverb', 'Spring reverb', 'Delay/echo', 'Slapback', 'Chorus', 'Flanger',
  'Phaser', 'Tremolo', 'Vibrato', 'Rotary', 'Overdrive', 'Distortion', 'Fuzz',
  'Tape saturation', 'Bitcrusher', 'Compression', 'Noise gate', 'Sidechain pump',
  'Wah', 'Auto-wah', 'Octave/pitch-shift', 'Harmonizer',
] as const;

export const MOOD_LABELS = [
  'warm', 'bright', 'gritty', 'dreamy', 'aggressive', 'clean', 'lo-fi', 'spacious',
] as const;

export type InstrumentLabel = typeof INSTRUMENT_LABELS[number];
export type EffectLabel = typeof EFFECT_LABELS[number];
export type MoodLabel = typeof MOOD_LABELS[number];

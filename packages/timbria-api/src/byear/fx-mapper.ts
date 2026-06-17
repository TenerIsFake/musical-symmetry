import type { FxCategory } from '../types.js';
import type { EarLabel } from './types.js';
import type { EffectLabel } from './vocab.js';

export const EFFECT_LABEL_TO_CATEGORY: Record<EffectLabel, FxCategory[]> = {
  'Reverb': ['reverb'], 'Spring reverb': ['reverb'],
  'Delay/echo': ['delay'], 'Slapback': ['delay'],
  'Chorus': ['modulation'], 'Flanger': ['modulation'], 'Phaser': ['modulation'],
  'Tremolo': ['modulation'], 'Vibrato': ['modulation'], 'Rotary': ['modulation'],
  'Overdrive': ['distortion'], 'Distortion': ['distortion'], 'Fuzz': ['distortion'],
  'Tape saturation': ['distortion'], 'Bitcrusher': ['distortion'],
  'Compression': ['dynamics'], 'Noise gate': ['dynamics'], 'Sidechain pump': ['dynamics'],
  'Wah': ['modulation'], 'Auto-wah': ['modulation'],
  'Octave/pitch-shift': ['pitch'], 'Harmonizer': ['pitch'],
};

export function mapEffectsToFxTypeIds(
  effects: EarLabel[],
  resolveByCategory: (cat: FxCategory) => number[],
): number[] {
  const ids = new Set<number>();
  for (const e of effects) {
    for (const cat of EFFECT_LABEL_TO_CATEGORY[e.label as EffectLabel] ?? []) {
      for (const id of resolveByCategory(cat)) ids.add(id);
    }
  }
  return [...ids];
}

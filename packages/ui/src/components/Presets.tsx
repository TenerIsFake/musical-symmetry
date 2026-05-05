import { useState } from 'react';
import type { PitchClass } from '@musical-symmetry/core';

interface Preset {
  name: string;
  pcs: PitchClass[];
  category: string;
  description: string;
}

const PRESETS: Preset[] = [
  // Triads
  { name: 'C major', pcs: [0, 4, 7], category: 'Triads', description: 'The most common chord in pop music' },
  { name: 'A minor', pcs: [9, 0, 4], category: 'Triads', description: 'Relative minor — same notes, different root' },
  { name: 'Diminished', pcs: [0, 3, 6], category: 'Triads', description: 'Tense, unstable — wants to resolve' },
  { name: 'Augmented', pcs: [0, 4, 8], category: 'Triads', description: 'Perfectly symmetric — floats without direction' },

  // 7th chords
  { name: 'Cmaj7', pcs: [0, 4, 7, 11], category: 'Extensions', description: 'Warm, dreamy — neo-soul staple' },
  { name: 'Dominant 7th', pcs: [0, 4, 7, 10], category: 'Extensions', description: 'Contains the tritone — pulls toward resolution' },
  { name: 'Diminished 7th', pcs: [0, 3, 6, 9], category: 'Extensions', description: 'Maximum symmetry for 4 notes — any note could be the root' },
  { name: 'Half-dim (m7b5)', pcs: [0, 3, 6, 10], category: 'Extensions', description: 'Jazz ii chord — dark but not as tense as full dim' },

  // Scales
  { name: 'Major scale', pcs: [0, 2, 4, 5, 7, 9, 11], category: 'Scales', description: 'The reference — everything else is measured against this' },
  { name: 'Pentatonic', pcs: [0, 2, 4, 7, 9], category: 'Scales', description: 'Remove the tension notes — universally pleasant' },
  { name: 'Whole-tone', pcs: [0, 2, 4, 6, 8, 10], category: 'Scales', description: 'Debussy sound — maximally even, zero gravity' },
  { name: 'Chromatic cluster', pcs: [0, 1, 2, 3, 4, 5], category: 'Scales', description: 'Six adjacent semitones — pure tension' },
  { name: 'Octatonic', pcs: [0, 1, 3, 4, 6, 7, 9, 10], category: 'Scales', description: 'Alternating half/whole steps — Messiaen, Stravinsky, metal' },

  // Famous progressions (as combined sets)
  { name: 'Tritone', pcs: [0, 6], category: 'Intervals', description: 'The "devil\'s interval" — splits the octave perfectly in half' },
  { name: 'Perfect 5th', pcs: [0, 7], category: 'Intervals', description: 'The most consonant interval after the octave' },
  { name: 'Minor 2nd', pcs: [0, 1], category: 'Intervals', description: 'Maximum dissonance — one semitone apart' },

  // Interesting sets
  { name: 'Mystic chord', pcs: [0, 2, 6, 8, 10, 3], category: 'Special', description: 'Scriabin\'s signature — quartal harmony from the overtone series' },
  { name: 'Petrushka chord', pcs: [0, 1, 3, 6, 7, 9], category: 'Special', description: 'Stravinsky — two major triads a tritone apart' },
  { name: '"Radiohead" chord', pcs: [0, 4, 6, 11], category: 'Special', description: 'Maj7#11 voicing — bright but unsettling' },
  { name: 'All notes', pcs: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], category: 'Special', description: 'The aggregate — total chromaticism, full D₁₂ symmetry' },
];

interface Props {
  onSelect: (pcs: PitchClass[]) => void;
  currentPCs: PitchClass[];
}

export default function Presets({ onSelect, currentPCs }: Props) {
  const [expanded, setExpanded] = useState(false);
  const categories = [...new Set(PRESETS.map(p => p.category))];

  const isActive = (preset: Preset) => {
    if (preset.pcs.length !== currentPCs.length) return false;
    const sorted = [...preset.pcs].sort((a, b) => a - b);
    return sorted.every((pc, i) => pc === currentPCs[i]);
  };

  const visibleCategories = expanded ? categories : categories.slice(0, 2);

  return (
    <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full mb-3"
      >
        <h2 className="text-sm font-semibold text-gray-400 uppercase">Examples</h2>
        <span className="text-xs text-gray-500">{expanded ? '▲ less' : '▼ more'}</span>
      </button>
      <div className="space-y-3">
        {visibleCategories.map(cat => (
          <div key={cat}>
            <h3 className="text-xs text-gray-500 uppercase mb-1.5">{cat}</h3>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.filter(p => p.category === cat).map(preset => (
                <button
                  key={preset.name}
                  onClick={() => onSelect(preset.pcs as PitchClass[])}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    isActive(preset)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title={preset.description}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

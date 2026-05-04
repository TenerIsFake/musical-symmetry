import { useMemo, useState } from 'react';
import { allFirstOrder, allSecondOrder, allThirdOrder, NOTE_NAMES } from '@musical-symmetry/core';
import type { Chord, ProgressionSuggestion, PitchClass } from '@musical-symmetry/core';

interface Props {
  chord: Chord | null;
}

const ORDER_COLORS = {
  1: { bg: 'bg-green-900/50', border: 'border-green-700', text: 'text-green-400', label: '1st Order' },
  2: { bg: 'bg-yellow-900/50', border: 'border-yellow-700', text: 'text-yellow-400', label: '2nd Order' },
  3: { bg: 'bg-red-900/50', border: 'border-red-700', text: 'text-red-400', label: '3rd Order' },
};

function SuggestionRow({ s }: { s: ProgressionSuggestion }) {
  const order = s.order as 1 | 2 | 3;
  const colors = ORDER_COLORS[order];

  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded ${colors.bg} border ${colors.border}`}>
      <div className="flex items-center gap-3">
        <span className={`font-mono font-bold ${colors.text}`}>{s.operator}</span>
        <span className="text-white text-sm">
          {NOTE_NAMES[s.to.root]} {s.to.quality}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span>CT: {s.commonTones.map(pc => NOTE_NAMES[pc as PitchClass]).join(', ') || 'none'}</span>
        <span>VL: {s.voiceLeadingDistance}</span>
      </div>
    </div>
  );
}

export default function ProgressionPanel({ chord }: Props) {
  const [expandedOrder, setExpandedOrder] = useState<number>(1);

  const suggestions = useMemo(() => {
    if (!chord || (chord.quality !== 'major' && chord.quality !== 'minor')) return null;
    return {
      first: allFirstOrder(chord),
      second: allSecondOrder(chord),
      third: allThirdOrder(chord),
    };
  }, [chord?.root, chord?.quality]);

  if (!suggestions) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Progressions</h2>
        <p className="text-gray-500 text-sm italic">Select a major or minor triad to see suggestions</p>
      </div>
    );
  }

  const sections = [
    { order: 1, items: suggestions.first },
    { order: 2, items: suggestions.second },
    { order: 3, items: suggestions.third },
  ] as const;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Progressions</h2>

      <div className="flex gap-2 mb-4">
        {sections.map(({ order }) => {
          const colors = ORDER_COLORS[order];
          return (
            <button
              key={order}
              onClick={() => setExpandedOrder(order)}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                expandedOrder === order
                  ? `${colors.bg} ${colors.text} border ${colors.border}`
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {colors.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {sections
          .filter(s => s.order === expandedOrder)
          .flatMap(s => s.items)
          .map((s, i) => (
            <SuggestionRow key={i} s={s} />
          ))}
      </div>
    </div>
  );
}

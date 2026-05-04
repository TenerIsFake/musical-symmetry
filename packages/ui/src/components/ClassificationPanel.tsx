import type { SymmetryAnalysis, Chord } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';

interface Props {
  analysis: SymmetryAnalysis | null;
  chord: Chord | null;
}

function PropertyBadge({ label, value }: { label: string; value: string | boolean }) {
  const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
  const colorClass = typeof value === 'boolean'
    ? value ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'
    : 'bg-blue-900 text-blue-300';

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`px-2 py-0.5 rounded text-xs font-mono ${colorClass}`}>
        {displayValue}
      </span>
    </div>
  );
}

export default function ClassificationPanel({ analysis, chord }: Props) {
  if (!analysis) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Classification</h2>
        <p className="text-gray-500 text-sm italic">Select at least 2 pitch classes to analyze</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Classification</h2>

      {chord && (
        <div className="mb-3 pb-3 border-b border-gray-700">
          <span className="text-lg font-bold text-white">
            {NOTE_NAMES[chord.root]} {chord.quality}
          </span>
        </div>
      )}

      <div className="space-y-1">
        <PropertyBadge label="Abstract Group" value={analysis.abstractGroup} />
        <PropertyBadge label="Mulliken Label" value={analysis.mullikenLabel} />
        <PropertyBadge label="Interval Vector" value={`[${analysis.intervalVector.join(', ')}]`} />
        <PropertyBadge label="Stabilizer Order" value={String(analysis.stabilizerOrder)} />
        <PropertyBadge label="Distinct Transpositions" value={String(analysis.distinctTranspositions)} />
        <PropertyBadge label="Maximally Even" value={analysis.maximallyEven} />
        <PropertyBadge label="Myhill Property" value={analysis.myhillProperty} />
        <PropertyBadge label="Palindromic" value={analysis.isRetrogradePalindrome} />
      </div>

      {analysis.characterTableEntry && Object.keys(analysis.characterTableEntry).length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-700">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Character Table</h3>
          <div className="grid grid-cols-2 gap-1 text-xs font-mono">
            {Object.entries(analysis.characterTableEntry).map(([op, val]) => (
              <div key={op} className="flex justify-between bg-gray-900 px-2 py-1 rounded">
                <span className="text-gray-400">{op}</span>
                <span className={val === 1 ? 'text-green-400' : 'text-red-400'}>
                  {val === 1 ? '+1' : '-1'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

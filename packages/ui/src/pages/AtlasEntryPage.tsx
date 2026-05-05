import { useState, useEffect } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';

interface AtlasEntry {
  forteNumber: string;
  primeForm: PitchClass[];
  group: string;
  stabilizerOrder: number;
  intervalVector: [number, number, number, number, number, number];
  mullikenLabel: string;
  maximallyEven: boolean;
  myhillProperty: boolean;
  distinctTranspositions: number;
  cardinality: number;
}

interface Props {
  forteNumber: string;
}

export default function AtlasEntryPage({ forteNumber }: Props) {
  const [entry, setEntry] = useState<AtlasEntry | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/atlas/${forteNumber}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(setEntry)
      .catch(() => setError('Set class not found'));
  }, [forteNumber]);

  if (error) return <div className="text-center mt-20 text-red-400">{error}</div>;
  if (!entry) return <div className="text-center mt-20 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <a href="#atlas" className="text-indigo-400 text-sm hover:underline mb-4 block">Back to Atlas</a>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold font-mono">{entry.forteNumber}</h1>
        <span className="px-3 py-1 bg-indigo-900 text-indigo-300 rounded text-lg">{entry.group}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Prime Form</h2>
          <div className="flex gap-2">
            {entry.primeForm.map(pc => (
              <span key={pc} className="px-3 py-1.5 bg-green-900 text-green-300 rounded font-mono text-lg">
                {NOTE_NAMES[pc]}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-2">Properties</h2>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Symmetry Group</span>
            <span className="text-white font-mono">{entry.group}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Mulliken Label</span>
            <span className="text-white font-mono">{entry.mullikenLabel}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Interval Vector</span>
            <span className="text-white font-mono">[{entry.intervalVector.join(', ')}]</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Stabilizer Order</span>
            <span className="text-white font-mono">{entry.stabilizerOrder}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Distinct Transpositions</span>
            <span className="text-white font-mono">{entry.distinctTranspositions}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Maximally Even</span>
            <span className={entry.maximallyEven ? 'text-green-400' : 'text-gray-500'}>{entry.maximallyEven ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Myhill Property</span>
            <span className={entry.myhillProperty ? 'text-green-400' : 'text-gray-500'}>{entry.myhillProperty ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <a
          href={`#classifier?pcs=${entry.primeForm.join(',')}`}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition"
        >
          Open in Classifier
        </a>
        <a
          href={`/api/og/orbit?pcs=${entry.primeForm.join(',')}`}
          target="_blank"
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
        >
          View OG Card
        </a>
      </div>
    </div>
  );
}

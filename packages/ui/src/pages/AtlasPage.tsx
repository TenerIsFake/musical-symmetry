import { useState, useEffect } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';

interface AtlasSummary {
  forteNumber: string;
  primeForm: PitchClass[];
  group: string;
  cardinality: number;
  intervalVector: number[];
  maximallyEven: boolean;
}

export default function AtlasPage() {
  const [entries, setEntries] = useState<AtlasSummary[]>([]);
  const [filterCardinality, setFilterCardinality] = useState<number | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>('');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetch('/api/atlas').then(r => r.json()).then(d => setEntries(d.entries));
  }, []);

  const groups = [...new Set(entries.map(e => e.group))].sort();
  const cardinalities = [...new Set(entries.map(e => e.cardinality))].sort((a, b) => a - b);

  const filtered = entries.filter(e => {
    if (filterCardinality && e.cardinality !== filterCardinality) return false;
    if (filterGroup && e.group !== filterGroup) return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      return e.forteNumber.includes(s)
        || e.group.toLowerCase().includes(s)
        || e.primeForm.map(pc => NOTE_NAMES[pc].toLowerCase()).some(n => n.includes(s));
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Symmetry Atlas</h1>
      <p className="text-gray-400 mb-6">
        Every pitch-class set class, classified by symmetry group. {entries.length} entries spanning cardinalities 2-8.
      </p>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="Search by Forte number, group, or note..."
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm w-64"
        />
        <select
          value={filterCardinality || ''}
          onChange={e => setFilterCardinality(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
        >
          <option value="">All cardinalities</option>
          {cardinalities.map(c => <option key={c} value={c}>{c} notes</option>)}
        </select>
        <select
          value={filterGroup}
          onChange={e => setFilterGroup(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
        >
          <option value="">All groups</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <span className="text-sm text-gray-500 self-center">{filtered.length} results</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(e => (
          <a
            key={e.forteNumber}
            href={`#atlas/${e.forteNumber}`}
            className="bg-gray-800 hover:bg-gray-750 rounded-lg p-4 transition border border-transparent hover:border-indigo-500/30"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-lg font-bold text-white">{e.forteNumber}</span>
              <span className="text-sm text-indigo-400">{e.group}</span>
            </div>
            <div className="flex gap-1 mb-2">
              {e.primeForm.map(pc => (
                <span key={pc} className="px-1.5 py-0.5 bg-gray-900 text-gray-300 text-xs rounded font-mono">
                  {NOTE_NAMES[pc]}
                </span>
              ))}
            </div>
            <div className="text-xs text-gray-500">
              IV: [{e.intervalVector.join(',')}]
              {e.maximallyEven && <span className="ml-2 text-green-400">max-even</span>}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

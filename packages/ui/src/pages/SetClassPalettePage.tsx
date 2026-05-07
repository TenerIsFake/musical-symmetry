import { useState, useCallback } from 'react';
import { NOTE_NAMES, allForms, toPcSet } from '@musical-symmetry/core';
import type { PitchClass, PcSetForm } from '@musical-symmetry/core';
import { useUser } from '../context/UserContext';
import { playPitchClasses } from '../utils/audio';

// ---------- Mini piano (display-only) ----------

function MiniPiano({ activePcs }: { activePcs: PitchClass[] }) {
  const activeSet = new Set(activePcs);
  const whiteKeys: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];
  const blackKeys: PitchClass[] = [1, 3, 6, 8, 10];
  const blackPositions: Record<number, number> = { 1: 0.6, 3: 1.6, 6: 3.6, 8: 4.6, 10: 5.6 };

  return (
    <div className="relative flex" style={{ height: '3rem' }}>
      {whiteKeys.map((pc) => (
        <div
          key={pc}
          title={NOTE_NAMES[pc]}
          className={`relative w-5 h-12 border border-gray-600 rounded-b flex items-end justify-center pb-0.5 text-[9px] font-bold select-none ${
            activeSet.has(pc) ? 'bg-indigo-400 text-white border-indigo-500' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {activeSet.has(pc) ? NOTE_NAMES[pc] : ''}
        </div>
      ))}
      {blackKeys.map((pc) => {
        const pos = blackPositions[pc]!;
        return (
          <div
            key={pc}
            title={NOTE_NAMES[pc]}
            style={{ position: 'absolute', left: `${pos * 20}px`, top: 0, zIndex: 10 }}
            className={`w-3.5 h-8 rounded-b flex items-end justify-center pb-0.5 text-[8px] font-bold select-none ${
              activeSet.has(pc) ? 'bg-indigo-500 text-white' : 'bg-gray-900 text-gray-500'
            }`}
          >
            {activeSet.has(pc) ? NOTE_NAMES[pc] : ''}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Interactive Piano (input) ----------

function PianoKeyboard({
  selected,
  onToggle,
}: {
  selected: Set<PitchClass>;
  onToggle: (pc: PitchClass) => void;
}) {
  const whiteKeys: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];
  const blackKeys: PitchClass[] = [1, 3, 6, 8, 10];
  const blackPositions: Record<number, number> = { 1: 0.6, 3: 1.6, 6: 3.6, 8: 4.6, 10: 5.6 };

  return (
    <div className="relative flex" style={{ height: '5rem' }}>
      {whiteKeys.map((pc) => (
        <button
          key={pc}
          onClick={() => onToggle(pc)}
          title={NOTE_NAMES[pc]}
          className={`relative w-8 h-20 border border-gray-600 rounded-b flex items-end justify-center pb-1 text-xs font-bold select-none transition-colors ${
            selected.has(pc) ? 'bg-indigo-400 text-white border-indigo-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {NOTE_NAMES[pc]}
        </button>
      ))}
      {blackKeys.map((pc) => {
        const pos = blackPositions[pc]!;
        return (
          <button
            key={pc}
            onClick={() => onToggle(pc)}
            title={NOTE_NAMES[pc]}
            style={{ position: 'absolute', left: `${pos * 32}px`, top: 0, zIndex: 10 }}
            className={`w-6 h-14 rounded-b flex items-end justify-center pb-1 text-xs font-bold select-none transition-colors ${
              selected.has(pc) ? 'bg-indigo-500 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {selected.has(pc) ? NOTE_NAMES[pc] : ''}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Palette Card ----------

function PaletteCard({ form }: { form: PcSetForm }) {
  const label =
    form.type === 'T'
      ? `T${form.n}`
      : `T${form.n}I`;

  const noteNames = form.pcs.map(pc => NOTE_NAMES[pc]).join(' ');

  function handleAudition() {
    playPitchClasses(form.pcs, 'chord', 1.2);
  }

  return (
    <button
      onClick={handleAudition}
      className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-left hover:border-indigo-500 hover:bg-gray-750 transition-colors group w-full"
      title="Click to audition"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-sm font-bold text-indigo-400">{label}</span>
        <span className="text-xs text-gray-500 group-hover:text-gray-400">▶</span>
      </div>
      <p className="text-xs text-gray-300 mb-2 truncate">{noteNames}</p>
      <MiniPiano activePcs={form.pcs} />
    </button>
  );
}

// ---------- Filter: Pitch Class Presence ----------

function PcFilter({
  value,
  onChange,
}: {
  value: PitchClass | null;
  onChange: (v: PitchClass | null) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-400">Contains:</label>
      <select
        value={value === null ? '' : String(value)}
        onChange={e => {
          const v = e.target.value;
          onChange(v === '' ? null : (parseInt(v, 10) as PitchClass));
        }}
        className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-2 py-1"
      >
        <option value="">Any</option>
        {([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as PitchClass[]).map(pc => (
          <option key={pc} value={pc}>
            {NOTE_NAMES[pc]} ({pc})
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------- Main Page ----------

export default function SetClassPalettePage() {
  const { user } = useUser();
  const tier = user?.tier ?? 'free';

  const [selected, setSelected] = useState<Set<PitchClass>>(new Set([0, 4, 7] as PitchClass[]));
  const [forms, setForms] = useState<PcSetForm[] | null>(null);
  const [filterPc, setFilterPc] = useState<PitchClass | null>(null);

  const togglePc = useCallback((pc: PitchClass) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(pc)) {
        next.delete(pc);
      } else {
        next.add(pc);
      }
      return next;
    });
    setForms(null);
  }, []);

  function handleShowForms() {
    const pcs = toPcSet([...selected] as PitchClass[]);
    if (pcs.length === 0) return;

    const cardinality = pcs.length;

    // Tier gate
    if (tier === 'free' && cardinality > 4) {
      alert('Free tier supports cardinality ≤ 4. Upgrade to Pro for all cardinalities.');
      return;
    }

    setForms(allForms(pcs));
  }

  function handleExportJson() {
    if (!forms) return;
    const json = JSON.stringify(forms, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'set-class-forms.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedPcArray = toPcSet([...selected] as PitchClass[]);
  const cardinality = selectedPcArray.length;

  const filteredForms = forms
    ? filterPc === null
      ? forms
      : forms.filter(f => f.pcs.includes(filterPc))
    : null;

  const transpositions = filteredForms ? filteredForms.filter(f => f.type === 'T') : [];
  const inversions = filteredForms ? filteredForms.filter(f => f.type === 'TnI') : [];

  const tierBlocked = tier === 'free' && cardinality > 4;

  return (
    <div className="space-y-6">
      {/* Input section */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-white">Select Pitch Classes</h2>

        <PianoKeyboard selected={selected} onToggle={togglePc} />

        <div className="flex flex-wrap gap-2 min-h-[2rem]">
          {selectedPcArray.length === 0 ? (
            <span className="text-sm text-gray-500 italic">No pitches selected</span>
          ) : (
            selectedPcArray.map(pc => (
              <span
                key={pc}
                className="px-2 py-0.5 rounded-full bg-indigo-700 text-white text-xs font-semibold"
              >
                {NOTE_NAMES[pc]}
              </span>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-400">
            Cardinality: <span className="text-white font-semibold">{cardinality}</span>
          </span>

          {tier === 'free' && cardinality > 4 && (
            <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded">
              Free tier: upgrade to Pro for cardinality &gt; 4
            </span>
          )}

          <button
            onClick={handleShowForms}
            disabled={selectedPcArray.length === 0 || tierBlocked}
            className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Show all forms
          </button>

          {tier === 'research' && forms && (
            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-600 text-white text-sm font-semibold transition-colors"
            >
              Export JSON
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {filteredForms && (
        <div className="space-y-6">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-4">
            <PcFilter value={filterPc} onChange={setFilterPc} />
            <span className="text-sm text-gray-500">
              {filteredForms.length} form{filteredForms.length !== 1 ? 's' : ''} shown
              {filterPc !== null ? ` (containing ${NOTE_NAMES[filterPc]})` : ''}
            </span>
          </div>

          {/* Transpositions */}
          {transpositions.length > 0 && (
            <section>
              <h3 className="text-base font-semibold text-indigo-300 mb-3">
                Transpositions ({transpositions.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {transpositions.map(form => (
                  <PaletteCard key={`T-${form.n}`} form={form} />
                ))}
              </div>
            </section>
          )}

          {/* Inversions */}
          {inversions.length > 0 && (
            <section>
              <h3 className="text-base font-semibold text-purple-300 mb-3">
                Inversions ({inversions.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {inversions.map(form => (
                  <PaletteCard key={`TnI-${form.n}`} form={form} />
                ))}
              </div>
            </section>
          )}

          {filteredForms.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              No forms match the current filter.
            </p>
          )}
        </div>
      )}

      {!forms && (
        <p className="text-center text-gray-600 py-8">
          Select notes above and click "Show all forms" to explore transpositions and inversions.
        </p>
      )}
    </div>
  );
}

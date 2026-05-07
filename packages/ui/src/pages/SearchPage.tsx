import { useMemo, useState, useCallback } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { classify, NOTE_NAMES, zRelated } from '@musical-symmetry/core';
import { normalize } from '@musical-symmetry/core';
import { useUser } from '../context/UserContext';

// ─── Forte number lookup (prime-form key → Forte label) ───────────────────────
// Built from the atlas catalog embedded in forte-numbers.ts + atlas/data.ts.
// We use normalize() to get prime form, then look up.
const FORTE_TABLE: Record<string, string> = {
  '0,1':'2-1','0,2':'2-2','0,3':'2-3','0,4':'2-4','0,5':'2-5','0,6':'2-6',
  '0,1,2':'3-1','0,1,3':'3-2','0,1,4':'3-3','0,1,5':'3-4','0,1,6':'3-5',
  '0,2,4':'3-6','0,2,5':'3-7','0,2,6':'3-8','0,2,7':'3-9','0,3,6':'3-10',
  '0,3,7':'3-11','0,4,8':'3-12',
  '0,1,2,3':'4-1','0,1,2,4':'4-2','0,1,3,4':'4-3','0,1,2,5':'4-4',
  '0,1,2,6':'4-5','0,1,2,7':'4-6','0,1,4,5':'4-7','0,1,5,6':'4-8',
  '0,1,6,7':'4-9','0,2,3,5':'4-10','0,1,3,5':'4-11','0,2,3,6':'4-12',
  '0,1,3,6':'4-13','0,2,3,7':'4-14','0,1,4,6':'4-Z15','0,1,5,7':'4-16',
  '0,3,4,7':'4-17','0,1,4,7':'4-18','0,1,4,8':'4-19','0,1,5,8':'4-20',
  '0,2,4,6':'4-21','0,2,4,7':'4-22','0,2,5,7':'4-23','0,2,4,8':'4-24',
  '0,2,6,8':'4-25','0,3,5,8':'4-26','0,2,5,8':'4-27','0,3,6,9':'4-28',
  '0,1,3,7':'4-Z29',
  '0,1,2,3,4':'5-1','0,1,2,3,5':'5-2','0,1,2,4,5':'5-3','0,1,2,3,6':'5-4',
  '0,1,2,3,7':'5-5','0,1,2,5,6':'5-6','0,1,2,6,7':'5-7','0,2,3,4,6':'5-8',
  '0,1,2,4,6':'5-9','0,1,3,4,6':'5-10','0,2,3,4,7':'5-11','0,1,3,5,6':'5-Z12',
  '0,1,2,4,8':'5-13','0,1,2,5,7':'5-14','0,1,2,6,8':'5-15',
  '0,1,3,4,7':'5-16','0,1,3,4,8':'5-Z17','0,1,4,5,7':'5-Z18',
  '0,1,3,6,7':'5-19','0,1,3,7,8':'5-20','0,1,4,5,8':'5-21',
  '0,1,4,7,8':'5-22','0,2,3,5,7':'5-23','0,1,3,5,7':'5-24',
  '0,2,3,5,8':'5-25','0,2,4,5,8':'5-26','0,1,3,5,8':'5-27',
  '0,2,3,6,8':'5-28','0,1,3,6,8':'5-29','0,1,4,6,8':'5-30',
  '0,1,3,6,9':'5-31','0,1,4,6,9':'5-32','0,2,4,6,8':'5-33',
  '0,2,4,6,9':'5-34','0,2,4,7,9':'5-35','0,1,2,4,7':'5-36',
  '0,3,4,5,8':'5-37','0,1,2,5,8':'5-38',
  '0,1,2,3,4,5':'6-1','0,1,2,3,4,6':'6-2','0,1,2,3,5,6':'6-Z3',
  '0,1,2,4,5,6':'6-Z4','0,1,2,3,6,7':'6-5','0,1,2,5,6,7':'6-Z6',
  '0,1,2,6,7,8':'6-7','0,2,3,4,5,7':'6-8','0,1,2,3,5,7':'6-9',
  '0,1,3,4,5,7':'6-Z10','0,1,2,4,5,7':'6-Z11','0,1,2,4,6,7':'6-Z12',
  '0,1,3,4,6,7':'6-Z13','0,1,3,4,5,8':'6-14','0,1,2,4,5,8':'6-15',
  '0,1,4,5,6,8':'6-16','0,1,2,4,7,8':'6-Z17','0,1,2,5,7,8':'6-18',
  '0,1,3,4,7,8':'6-Z19','0,1,4,5,8,9':'6-20','0,2,3,4,6,8':'6-21',
  '0,1,2,4,6,8':'6-22','0,2,3,5,6,8':'6-Z23','0,1,3,4,6,8':'6-Z24',
  '0,1,3,5,6,8':'6-Z25','0,1,3,5,7,8':'6-Z26','0,1,3,4,6,9':'6-27',
  '0,1,3,5,6,9':'6-Z28','0,2,3,6,7,9':'6-Z29','0,1,3,6,7,9':'6-30',
  '0,1,3,5,8,9':'6-31','0,2,4,5,7,9':'6-32','0,2,3,5,7,9':'6-33',
  '0,1,3,5,7,9':'6-34','0,2,4,6,8,10':'6-35',
  '0,1,2,3,4,5,6':'7-1','0,1,2,3,4,5,7':'7-2','0,1,2,3,4,5,8':'7-3',
  '0,1,2,3,4,6,7':'7-4','0,1,2,3,5,6,7':'7-5','0,1,2,3,4,7,8':'7-6',
  '0,1,2,3,6,7,8':'7-7','0,2,3,4,5,6,8':'7-8','0,1,2,3,4,6,8':'7-9',
  '0,1,2,3,4,6,9':'7-10','0,1,3,4,5,6,8':'7-11','0,1,2,3,4,7,9':'7-Z12',
  '0,1,2,4,5,6,8':'7-13','0,1,2,3,5,7,8':'7-14','0,1,2,4,6,7,8':'7-15',
  '0,1,2,3,5,6,9':'7-16','0,1,2,4,5,6,9':'7-Z17','0,1,4,5,6,7,9':'7-Z18',
  '0,1,2,3,6,7,9':'7-19','0,1,2,5,6,7,9':'7-20','0,1,2,4,5,8,9':'7-21',
  '0,1,2,5,6,8,9':'7-22','0,2,3,4,5,7,9':'7-23','0,1,2,3,5,7,9':'7-24',
  '0,2,3,4,6,7,9':'7-25','0,1,3,4,5,7,9':'7-26','0,1,2,4,5,7,9':'7-27',
  '0,1,3,5,6,7,9':'7-28','0,1,2,4,6,7,9':'7-29','0,1,2,4,6,8,9':'7-30',
  '0,1,3,4,6,7,9':'7-31','0,1,3,4,6,8,9':'7-32','0,1,2,4,6,8,10':'7-33',
  '0,1,3,4,6,8,10':'7-34','0,1,3,5,6,8,10':'7-35',
  '0,1,2,3,4,5,6,7':'8-1','0,1,2,3,4,5,6,8':'8-2','0,1,2,3,4,5,6,9':'8-3',
  '0,1,2,3,4,5,7,8':'8-4','0,1,2,3,4,6,7,8':'8-5','0,1,2,3,5,6,7,8':'8-6',
  '0,1,2,3,4,5,8,9':'8-7','0,1,2,3,4,7,8,9':'8-8','0,1,2,3,6,7,8,9':'8-9',
  '0,2,3,4,5,6,7,9':'8-10','0,1,2,3,4,5,7,9':'8-11','0,1,3,4,5,6,7,9':'8-12',
  '0,1,2,3,4,6,7,9':'8-13','0,1,2,4,5,6,7,9':'8-14','0,1,2,3,4,6,8,9':'8-Z15',
  '0,1,2,3,5,7,8,9':'8-16','0,1,3,4,5,6,8,9':'8-17','0,1,2,3,5,6,8,9':'8-18',
  '0,1,2,4,5,6,8,9':'8-19','0,1,2,4,5,7,8,9':'8-20','0,1,2,3,4,6,8,10':'8-21',
  '0,1,2,3,5,6,8,10':'8-22','0,1,2,3,5,7,8,10':'8-23','0,1,2,4,5,6,8,10':'8-24',
  '0,1,2,4,6,7,8,10':'8-25','0,1,3,4,5,7,8,10':'8-26','0,1,2,4,5,7,8,10':'8-27',
  '0,1,3,4,6,7,8,10':'8-28','0,1,2,3,5,6,7,9':'8-Z29',
  '0,1,2,3,4,5,6,7,8':'9-1','0,1,2,3,4,5,6,7,9':'9-2','0,1,2,3,4,5,6,8,9':'9-3',
  '0,1,2,3,4,5,7,8,9':'9-4','0,1,2,3,4,6,7,8,9':'9-5','0,1,2,3,4,5,6,8,10':'9-6',
  '0,1,2,3,4,5,7,8,10':'9-7','0,1,2,3,4,6,7,8,10':'9-8','0,1,2,3,5,6,7,8,10':'9-9',
  '0,1,2,3,4,6,7,9,10':'9-10','0,1,2,3,5,6,7,9,10':'9-11','0,1,2,4,5,6,8,9,10':'9-12',
};

function getForteNumber(pcs: PitchClass[]): string | null {
  if (pcs.length < 2 || pcs.length > 9) return null;
  try {
    const normal = normalize(pcs);
    const key = normal.join(',');
    return FORTE_TABLE[key] ?? null;
  } catch {
    return null;
  }
}

// ─── Pre-built set record ──────────────────────────────────────────────────────
interface SetRecord {
  mask: number;
  pcs: PitchClass[];
  cardinality: number;
  abstractGroup: string;
  intervalVector: [number, number, number, number, number, number];
  myhillProperty: boolean;
  maximallyEven: boolean;
  isRetrogradePalindrome: boolean;
  forteNumber: string | null;
  // Z-relation is expensive to check per-pair; we flag it lazily
  hasZPair?: boolean;
}

// ─── Filter state ─────────────────────────────────────────────────────────────
const ALL_GROUPS = ['C1', 'Z2', 'C2', 'C3', 'C4', 'C6', 'D2', 'D3', 'D4', 'D6', 'D12'] as const;
const PAGE_SIZE = 20;
const FREE_LIMIT = 50;

function initCardinalitySet(): Set<number> {
  return new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
}

interface IVConstraint {
  min: string;
  max: string;
}

function emptyIVConstraints(): IVConstraint[] {
  return Array.from({ length: 6 }, () => ({ min: '', max: '' }));
}

export default function SearchPage() {
  const { user } = useUser();
  const isResearch = user?.tier === 'research';

  // ── Filter state ────────────────────────────────────────────────────────────
  const [cardinalityFilter, setCardinalityFilter] = useState<Set<number>>(initCardinalitySet);
  const [groupFilter, setGroupFilter] = useState<Set<string>>(new Set());
  const [ivConstraints, setIVConstraints] = useState<IVConstraint[]>(emptyIVConstraints);
  const [propMaxEven, setPropMaxEven] = useState(false);
  const [propMyhill, setPropMyhill] = useState(false);
  const [propZPair, setPropZPair] = useState(false);
  const [propRetrograde, setPropRetrograde] = useState(false);
  const [textSearch, setTextSearch] = useState('');
  const [page, setPage] = useState(0);

  // ── Precompute all 4095 subsets ─────────────────────────────────────────────
  const ALL_SETS = useMemo<SetRecord[]>(() => {
    const sets: SetRecord[] = [];
    for (let mask = 1; mask < 4096; mask++) {
      const pcs: PitchClass[] = [];
      for (let i = 0; i < 12; i++) {
        if (mask & (1 << i)) pcs.push(i as PitchClass);
      }
      const analysis = classify(pcs);
      sets.push({
        mask,
        pcs,
        cardinality: pcs.length,
        abstractGroup: analysis.abstractGroup,
        intervalVector: analysis.intervalVector,
        myhillProperty: analysis.myhillProperty,
        maximallyEven: analysis.maximallyEven,
        isRetrogradePalindrome: analysis.isRetrogradePalindrome,
        forteNumber: getForteNumber(pcs),
      });
    }
    return sets;
  }, []);

  // ── Z-relation map (built once from ALL_SETS) ───────────────────────────────
  // We index sets by their interval vector string so we can quickly group Z-pairs.
  const zPairMasks = useMemo<Set<number>>(() => {
    const ivKey = (iv: number[]) => iv.join(',');
    const byIV = new Map<string, SetRecord[]>();
    for (const s of ALL_SETS) {
      const k = ivKey(s.intervalVector);
      const bucket = byIV.get(k);
      if (bucket) bucket.push(s); else byIV.set(k, [s]);
    }
    const zMasks = new Set<number>();
    for (const bucket of byIV.values()) {
      if (bucket.length < 2) continue;
      // Check if any pair in this bucket are genuinely Z-related (not just transpositionally/inversionally equiv.)
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          if (zRelated(bucket[i]!.pcs, bucket[j]!.pcs)) {
            zMasks.add(bucket[i]!.mask);
            zMasks.add(bucket[j]!.mask);
          }
        }
      }
    }
    return zMasks;
  }, [ALL_SETS]);

  // ── Filtered results ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const lowerText = textSearch.toLowerCase().trim();
    return ALL_SETS.filter(s => {
      // Cardinality
      if (!cardinalityFilter.has(s.cardinality)) return false;

      // Group
      if (groupFilter.size > 0 && !groupFilter.has(s.abstractGroup)) return false;

      // Interval vector constraints
      for (let ic = 0; ic < 6; ic++) {
        const c = ivConstraints[ic]!;
        const val = s.intervalVector[ic]!;
        if (c.min !== '') {
          const mn = parseInt(c.min, 10);
          if (!isNaN(mn) && val < mn) return false;
        }
        if (c.max !== '') {
          const mx = parseInt(c.max, 10);
          if (!isNaN(mx) && val > mx) return false;
        }
      }

      // Property filters
      if (propMaxEven && !s.maximallyEven) return false;
      if (propMyhill && !s.myhillProperty) return false;
      if (propZPair && !zPairMasks.has(s.mask)) return false;
      if (propRetrograde && !s.isRetrogradePalindrome) return false;

      // Text search
      if (lowerText) {
        const noteStr = s.pcs.map(pc => NOTE_NAMES[pc]).join(' ').toLowerCase();
        const forteStr = (s.forteNumber ?? '').toLowerCase();
        const groupStr = s.abstractGroup.toLowerCase();
        if (
          !forteStr.includes(lowerText) &&
          !noteStr.includes(lowerText) &&
          !groupStr.includes(lowerText)
        ) return false;
      }

      return true;
    });
  }, [ALL_SETS, cardinalityFilter, groupFilter, ivConstraints, propMaxEven, propMyhill, propZPair, propRetrograde, textSearch, zPairMasks]);

  // ── Tier-limited display slice ───────────────────────────────────────────────
  const displayLimit = isResearch ? Infinity : FREE_LIMIT;
  const displayResults = filtered.slice(0, Math.min(filtered.length, displayLimit));
  const totalPages = Math.ceil(displayResults.length / PAGE_SIZE);
  const pageResults = displayResults.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // ── Navigate to classifier ───────────────────────────────────────────────────
  const loadInClassifier = useCallback((pcs: PitchClass[]) => {
    const params = new URLSearchParams({ pcs: pcs.join(',') });
    window.location.hash = `classifier?${params.toString()}`;
  }, []);

  // ── CSV Export ───────────────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    if (!isResearch) return;
    const rows = [
      ['Forte Number', 'Pitch Classes', 'Note Names', 'Group', 'Cardinality',
       'IV1', 'IV2', 'IV3', 'IV4', 'IV5', 'IV6',
       'Max Even', 'Myhill', 'Z Pair', 'Retrograde Palindrome'].join(','),
      ...filtered.map(s => [
        s.forteNumber ?? '',
        `"${s.pcs.join(' ')}"`,
        `"${s.pcs.map(pc => NOTE_NAMES[pc]).join(' ')}"`,
        s.abstractGroup,
        s.cardinality,
        ...s.intervalVector,
        s.maximallyEven ? '1' : '0',
        s.myhillProperty ? '1' : '0',
        zPairMasks.has(s.mask) ? '1' : '0',
        s.isRetrogradePalindrome ? '1' : '0',
      ].join(',')),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'symmetry-search.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered, isResearch, zPairMasks]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const toggleCardinality = (n: number) => {
    setPage(0);
    setCardinalityFilter(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  };

  const toggleGroup = (g: string) => {
    setPage(0);
    setGroupFilter(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  const updateIV = (ic: number, field: 'min' | 'max', val: string) => {
    setPage(0);
    setIVConstraints(prev => {
      const next = [...prev];
      next[ic] = { ...next[ic]!, [field]: val };
      return next;
    });
  };

  const resetFilters = () => {
    setCardinalityFilter(initCardinalitySet());
    setGroupFilter(new Set());
    setIVConstraints(emptyIVConstraints());
    setPropMaxEven(false);
    setPropMyhill(false);
    setPropZPair(false);
    setPropRetrograde(false);
    setTextSearch('');
    setPage(0);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Filters ── */}
      <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Filters</h2>
          <button
            onClick={resetFilters}
            className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
          >
            Reset all
          </button>
        </div>

        {/* Text search */}
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">
            Search (Forte number, note names, group)
          </label>
          <input
            value={textSearch}
            onChange={e => { setTextSearch(e.target.value); setPage(0); }}
            placeholder='e.g. "5-35" or "C D E" or "D6"'
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Cardinality */}
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
            Cardinality (notes in set)
          </label>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => toggleCardinality(n)}
                className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                  cardinalityFilter.has(n)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Symmetry group */}
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
            Symmetry group {groupFilter.size > 0 && <span className="text-indigo-400 normal-case ml-1">({groupFilter.size} selected)</span>}
          </label>
          <div className="flex flex-wrap gap-2">
            {ALL_GROUPS.map(g => (
              <button
                key={g}
                onClick={() => toggleGroup(g)}
                className={`px-3 py-1 rounded text-sm font-mono transition-colors ${
                  groupFilter.has(g)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Interval vector constraints */}
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
            Interval vector constraints (IC 1–6)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {ivConstraints.map((c, ic) => (
              <div key={ic} className="bg-gray-900 rounded p-2">
                <div className="text-xs text-gray-500 mb-1 font-mono">IC {ic + 1}</div>
                <div className="flex gap-1">
                  <input
                    value={c.min}
                    onChange={e => updateIV(ic, 'min', e.target.value)}
                    placeholder="min"
                    className="w-full px-1.5 py-1 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    value={c.max}
                    onChange={e => updateIV(ic, 'max', e.target.value)}
                    placeholder="max"
                    className="w-full px-1.5 py-1 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Property checkboxes */}
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
            Properties
          </label>
          <div className="flex flex-wrap gap-4">
            {([
              [propMaxEven, setPropMaxEven, 'Maximally even'],
              [propMyhill, setPropMyhill, 'Myhill property'],
              [propZPair, setPropZPair, 'Z-related pair exists'],
              [propRetrograde, setPropRetrograde, 'Retrograde palindrome'],
            ] as [boolean, React.Dispatch<React.SetStateAction<boolean>>, string][]).map(([val, setter, label]) => (
              <label key={label} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={val}
                  onChange={e => { setter(e.target.checked); setPage(0); }}
                  className="w-4 h-4 rounded accent-indigo-500"
                />
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ── Results header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {filtered.length.toLocaleString()} result{filtered.length !== 1 ? 's' : ''}
            {!isResearch && filtered.length > FREE_LIMIT && (
              <span className="ml-2 text-amber-400">
                (showing {FREE_LIMIT} — <a href="#dashboard" className="underline hover:text-amber-300">upgrade to Research</a> for all)
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isResearch ? (
            <button
              onClick={exportCSV}
              className="px-3 py-1.5 rounded text-sm font-medium bg-emerald-700 hover:bg-emerald-600 text-white transition-colors"
            >
              Export CSV
            </button>
          ) : (
            <span className="text-xs text-gray-500 italic">
              CSV export: Research tier
            </span>
          )}
        </div>
      </div>

      {/* ── Results grid ── */}
      {pageResults.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          No pitch-class sets match the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {pageResults.map(s => (
            <button
              key={s.mask}
              onClick={() => loadInClassifier(s.pcs)}
              className="bg-gray-800/50 hover:bg-gray-700/60 border border-gray-700/50 hover:border-indigo-500/40 rounded-xl p-4 text-left transition-all group"
              title="Click to load in Classifier"
            >
              {/* Forte number + group */}
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm font-bold text-white">
                  {s.forteNumber ?? `{${s.pcs.join(',')}}`}
                </span>
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-300">
                  {s.abstractGroup}
                </span>
              </div>

              {/* Note names */}
              <div className="text-xs text-gray-300 mb-2 font-medium">
                {s.pcs.map(pc => NOTE_NAMES[pc]).join(' · ')}
              </div>

              {/* Pitch classes */}
              <div className="flex flex-wrap gap-1 mb-3">
                {s.pcs.map(pc => (
                  <span
                    key={pc}
                    className="w-5 h-5 rounded-full bg-gray-700 text-gray-300 text-[10px] flex items-center justify-center font-mono"
                  >
                    {pc}
                  </span>
                ))}
              </div>

              {/* Interval vector */}
              <div className="font-mono text-xs text-gray-400 mb-2">
                IV: [{s.intervalVector.join(',')}]
              </div>

              {/* Property badges */}
              <div className="flex flex-wrap gap-1">
                {s.maximallyEven && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400">Max Even</span>
                )}
                {s.myhillProperty && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/50 text-blue-400">Myhill</span>
                )}
                {zPairMasks.has(s.mask) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-900/50 text-purple-400">Z-pair</span>
                )}
                {s.isRetrogradePalindrome && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/50 text-amber-400">Palindrome</span>
                )}
              </div>

              <div className="mt-2 text-[10px] text-gray-600 group-hover:text-indigo-400 transition-colors">
                Click to open in Classifier
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>
          <span className="text-sm text-gray-400 px-2">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 rounded text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

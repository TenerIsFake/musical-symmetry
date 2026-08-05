import { useState, useCallback, useMemo } from 'react';
import FileUpload from '../components/FileUpload';
import TimelineChart from '../components/TimelineChart';
import { useUser } from '../context/UserContext';
import type { SliceData } from '../components/TimelineChart';
import { API_BASE } from '../utils/apiBase';

const NOTE_NAMES_LOCAL: Record<number, string> = {
  0: 'C', 1: 'C♯', 2: 'D', 3: 'E♭', 4: 'E', 5: 'F',
  6: 'F♯', 7: 'G', 8: 'A♭', 9: 'A', 10: 'B♭', 11: 'B',
};

interface AnalysisResult {
  filename: string;
  format: string;
  totalBeats: number;
  totalMeasures: number;
  slices: SliceData[];
}

async function fetchAnalysis(file: File): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sliceMode', 'beat');
  formData.append('minNotes', '2');

  const res = await fetch(`${API_BASE}/api/analyze`, { method: 'POST', body: formData, credentials: 'include' });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  const slices: SliceData[] = data.slices.map((s: any) => ({
    startBeat: s.slice.startBeat,
    endBeat: s.slice.endBeat,
    abstractGroup: s.analysis.abstractGroup,
    mullikenLabel: s.analysis.mullikenLabel,
    stabilizerOrder: s.analysis.stabilizerOrder,
    chordName: s.chord ? `${NOTE_NAMES_LOCAL[s.chord.root] ?? '?'} ${s.chord.quality}` : null,
    voiceLeadingFromPrev: s.analysis.voiceLeadingFromPrev ?? null,
  }));
  return { filename: data.filename, format: data.format, totalBeats: data.totalBeats, totalMeasures: data.totalMeasures, slices };
}

// ── Stat helpers ──────────────────────────────────────────────────────────────

function getMostCommonGroup(slices: SliceData[]): string {
  const counts = slices.reduce<Record<string, number>>((acc, s) => {
    acc[s.abstractGroup] = (acc[s.abstractGroup] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
}

function getAvgStabilizer(slices: SliceData[]): string {
  if (slices.length === 0) return '—';
  return (slices.reduce((s, x) => s + x.stabilizerOrder, 0) / slices.length).toFixed(2);
}

function getForteSet(slices: SliceData[]): Set<string> {
  const out = new Set<string>();
  // We don't have raw PCs per slice here — use abstractGroup as proxy key
  slices.forEach(s => out.add(s.abstractGroup));
  return out;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const inter = [...a].filter(x => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1 : inter / union;
}

function correlationSimilarity(a: SliceData[], b: SliceData[]): number {
  // Compare stabilizer order distribution as a simple correlation proxy
  const groupsA = a.reduce<Record<string, number>>((acc, s) => {
    acc[s.abstractGroup] = (acc[s.abstractGroup] ?? 0) + 1;
    return acc;
  }, {});
  const groupsB = b.reduce<Record<string, number>>((acc, s) => {
    acc[s.abstractGroup] = (acc[s.abstractGroup] ?? 0) + 1;
    return acc;
  }, {});
  const allGroups = new Set([...Object.keys(groupsA), ...Object.keys(groupsB)]);
  let dot = 0, magA = 0, magB = 0;
  allGroups.forEach(g => {
    const va = (groupsA[g] ?? 0) / a.length;
    const vb = (groupsB[g] ?? 0) / b.length;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  });
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function computeSimilarity(a: AnalysisResult, b: AnalysisResult): number {
  const sA = getForteSet(a.slices);
  const sB = getForteSet(b.slices);
  const jaccard = jaccardSimilarity(sA, sB);
  const corr = correlationSimilarity(a.slices, b.slices);
  return Math.round(((jaccard + corr) / 2) * 100);
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface UploadZoneProps {
  label: string;
  result: AnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  onUpload: (file: File) => void;
  selectedIndex: number | null;
  onSelectSlice: (i: number) => void;
}

function UploadZone({ label, result, isLoading, error, onUpload, selectedIndex, onSelectSlice }: UploadZoneProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300 uppercase">{label}</h3>
      {!result ? (
        <FileUpload onUpload={onUpload} isLoading={isLoading} />
      ) : (
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white font-medium truncate">{result.filename}</span>
            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{result.slices.length} slices</span>
          </div>
          <TimelineChart
            slices={result.slices}
            onSelectSlice={onSelectSlice}
            selectedIndex={selectedIndex}
          />
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div className="bg-gray-900 rounded p-2">
              <div className="text-sm font-bold text-indigo-400">{result.totalBeats}</div>
              <div className="text-xs text-gray-500">Beats</div>
            </div>
            <div className="bg-gray-900 rounded p-2">
              <div className="text-sm font-bold text-green-400">{getAvgStabilizer(result.slices)}</div>
              <div className="text-xs text-gray-500">Avg Stab.</div>
            </div>
            <div className="bg-gray-900 rounded p-2">
              <div className="text-sm font-bold text-yellow-400">{getMostCommonGroup(result.slices)}</div>
              <div className="text-xs text-gray-500">Top Group</div>
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded p-2 text-red-300 text-xs">{error}</div>
      )}
      {isLoading && !result && (
        <p className="text-gray-400 text-sm text-center animate-pulse">Analyzing...</p>
      )}
    </div>
  );
}

interface DiffPanelProps {
  a: AnalysisResult;
  b: AnalysisResult;
}

function DiffPanel({ a, b }: DiffPanelProps) {
  // Find slices where the symmetry group differs (aligned by index)
  const minLen = Math.min(a.slices.length, b.slices.length);
  const diffSlices = Array.from({ length: minLen }, (_, i) => ({
    index: i,
    groupA: a.slices[i]!.abstractGroup,
    groupB: b.slices[i]!.abstractGroup,
    beatA: a.slices[i]!.startBeat,
    differs: a.slices[i]!.abstractGroup !== b.slices[i]!.abstractGroup,
  })).filter(d => d.differs);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
        Symmetry Diff
        <span className="ml-2 text-gray-600 font-normal normal-case">{diffSlices.length} of {minLen} slices differ</span>
      </h3>
      {diffSlices.length === 0 ? (
        <p className="text-green-400 text-sm">All aligned slices share the same symmetry group.</p>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {diffSlices.map(d => (
            <div key={d.index} className="flex items-center gap-3 text-xs font-mono bg-gray-900 rounded px-3 py-1.5">
              <span className="text-gray-500 w-12">Sl. {d.index + 1}</span>
              <span className="text-gray-500 w-16">b{d.beatA.toFixed(0)}</span>
              <span className="text-blue-300">{d.groupA}</span>
              <span className="text-gray-600">vs</span>
              <span className="text-orange-300">{d.groupB}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface VennBarProps {
  a: AnalysisResult;
  b: AnalysisResult;
  labelA: string;
  labelB: string;
}

function VennBar({ a, b, labelA, labelB }: VennBarProps) {
  const groupsA = new Set(a.slices.map(s => s.abstractGroup));
  const groupsB = new Set(b.slices.map(s => s.abstractGroup));
  const onlyA = [...groupsA].filter(g => !groupsB.has(g));
  const onlyB = [...groupsB].filter(g => !groupsA.has(g));
  const both = [...groupsA].filter(g => groupsB.has(g));

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Symmetry Group Usage</h3>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-blue-400 font-semibold mb-1">{labelA} only</div>
          {onlyA.length === 0 ? (
            <span className="text-gray-600 text-xs italic">none</span>
          ) : onlyA.map(g => (
            <span key={g} className="inline-block px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 text-xs font-mono mr-1 mb-1">{g}</span>
          ))}
        </div>
        <div>
          <div className="text-xs text-purple-400 font-semibold mb-1">Both</div>
          {both.length === 0 ? (
            <span className="text-gray-600 text-xs italic">none</span>
          ) : both.map(g => (
            <span key={g} className="inline-block px-2 py-0.5 rounded bg-purple-900/40 text-purple-300 text-xs font-mono mr-1 mb-1">{g}</span>
          ))}
        </div>
        <div>
          <div className="text-xs text-orange-400 font-semibold mb-1">{labelB} only</div>
          {onlyB.length === 0 ? (
            <span className="text-gray-600 text-xs italic">none</span>
          ) : onlyB.map(g => (
            <span key={g} className="inline-block px-2 py-0.5 rounded bg-orange-900/40 text-orange-300 text-xs font-mono mr-1 mb-1">{g}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const { user } = useUser();
  const tier = user?.tier ?? 'free';

  const [resultA, setResultA] = useState<AnalysisResult | null>(null);
  const [resultB, setResultB] = useState<AnalysisResult | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [errorA, setErrorA] = useState<string | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);
  const [selectedA, setSelectedA] = useState<number | null>(null);
  const [selectedB, setSelectedB] = useState<number | null>(null);

  const isPro = tier === 'pro' || tier === 'research';

  const handleUploadA = useCallback(async (file: File) => {
    setLoadingA(true);
    setErrorA(null);
    try {
      setResultA(await fetchAnalysis(file));
    } catch (e) {
      setErrorA(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setLoadingA(false);
    }
  }, []);

  const handleUploadB = useCallback(async (file: File) => {
    setLoadingB(true);
    setErrorB(null);
    try {
      setResultB(await fetchAnalysis(file));
    } catch (e) {
      setErrorB(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setLoadingB(false);
    }
  }, []);

  const similarity = useMemo(() => {
    if (!resultA || !resultB) return null;
    return computeSimilarity(resultA, resultB);
  }, [resultA, resultB]);

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
        <div className="text-4xl text-gray-600">&#128274;</div>
        <h2 className="text-xl font-bold text-white">Pro Tier Required</h2>
        <p className="text-gray-400 max-w-sm text-sm">
          Compare Mode lets you upload two MIDI or MusicXML files and view their symmetry differences side by side.
          Upgrade to Pro to unlock this feature.
        </p>
        <a
          href="#dashboard"
          className="px-5 py-2 rounded bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
        >
          View Plans
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload zones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UploadZone
          label="File A"
          result={resultA}
          isLoading={loadingA}
          error={errorA}
          onUpload={handleUploadA}
          selectedIndex={selectedA}
          onSelectSlice={setSelectedA}
        />
        <UploadZone
          label="File B"
          result={resultB}
          isLoading={loadingB}
          error={errorB}
          onUpload={handleUploadB}
          selectedIndex={selectedB}
          onSelectSlice={setSelectedB}
        />
      </div>

      {/* Similarity score */}
      {similarity !== null && (
        <div className="bg-gray-800 rounded-lg p-4 flex flex-col sm:flex-row items-center gap-6">
          <div className="text-center">
            <div className="text-5xl font-bold text-white">{similarity}%</div>
            <div className="text-xs text-gray-400 mt-1 uppercase tracking-wide">Similarity Score</div>
          </div>
          <div className="flex-1 space-y-2">
            {/* Progress bar */}
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${similarity}%`,
                  background: similarity >= 70 ? '#22c55e' : similarity >= 40 ? '#eab308' : '#ef4444',
                }}
              />
            </div>
            <p className="text-sm text-gray-400">
              {similarity >= 70
                ? 'High similarity — these pieces share most of their harmonic palette.'
                : similarity >= 40
                ? 'Moderate similarity — overlapping symmetry groups with distinct differences.'
                : 'Low similarity — very different harmonic structures.'}
            </p>
            <p className="text-xs text-gray-600">
              Score combines Jaccard similarity of symmetry groups and group-distribution correlation.
            </p>
          </div>
        </div>
      )}

      {/* Diff panel + Venn bar */}
      {resultA && resultB && (
        <>
          <DiffPanel a={resultA} b={resultB} />
          <VennBar a={resultA} b={resultB} labelA={resultA.filename} labelB={resultB.filename} />
        </>
      )}

      {/* Summary stats table */}
      {resultA && resultB && (
        <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Summary Comparison</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b border-gray-700">
                <th className="text-left py-2 pr-4">Metric</th>
                <th className="text-right py-2 px-4 text-blue-400">{resultA.filename}</th>
                <th className="text-right py-2 pl-4 text-orange-400">{resultB.filename}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {[
                { label: 'Total Beats', a: resultA.totalBeats, b: resultB.totalBeats },
                { label: 'Total Measures', a: resultA.totalMeasures, b: resultB.totalMeasures },
                { label: 'Total Slices', a: resultA.slices.length, b: resultB.slices.length },
                { label: 'Unique Groups', a: new Set(resultA.slices.map(s => s.abstractGroup)).size, b: new Set(resultB.slices.map(s => s.abstractGroup)).size },
                { label: 'Most Common Group', a: getMostCommonGroup(resultA.slices), b: getMostCommonGroup(resultB.slices) },
                { label: 'Avg Stabilizer', a: getAvgStabilizer(resultA.slices), b: getAvgStabilizer(resultB.slices) },
              ].map(row => (
                <tr key={row.label}>
                  <td className="py-2 pr-4 text-gray-400">{row.label}</td>
                  <td className="py-2 px-4 text-right font-mono text-blue-300">{row.a}</td>
                  <td className="py-2 pl-4 text-right font-mono text-orange-300">{row.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Waiting state */}
      {!resultA && !resultB && !loadingA && !loadingB && (
        <div className="text-center py-12 text-gray-500 text-sm">
          Upload two MIDI or MusicXML files above to compare their symmetry structures.
        </div>
      )}
    </div>
  );
}

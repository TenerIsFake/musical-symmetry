import { useState, useRef, useEffect, useCallback } from 'react';
import { useUser } from '../context/UserContext';
import { API_BASE } from '../utils/apiBase';
import { isNativePlatform } from '../utils/platform';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CorpusStats {
  fileCount: number;
  totalSlices: number;
  topSetClasses: Array<{ forte: string; count: number; percentage: number }>;
  groupDistribution: Record<string, number>;
  cardinalityDistribution: Record<number, number>;
  zRelationDensity: number;
  averageIntervalVector: number[];
  perFileSummary: Array<{
    filename: string;
    sliceCount: number;
    topForte: string;
    dominantGroup: string;
  }>;
}

interface CorpusSummary {
  id: number;
  name: string;
  fileCount: number;
  createdAt: string;
}

interface CorpusFull extends CorpusSummary {
  stats: CorpusStats;
}

interface AnalyzeResult {
  corpusId: number | null;
  name: string;
  stats: CorpusStats;
  errors?: Array<{ filename: string; error: string }>;
}

// ─── Group color map ──────────────────────────────────────────────────────────

const GROUP_COLORS: Record<string, string> = {
  C1: '#6b7280', Z2: '#8b5cf6', C2: '#3b82f6', C3: '#06b6d4', C4: '#10b981',
  C6: '#22c55e', D2: '#eab308', D3: '#f97316', D4: '#ef4444', D6: '#dc2626',
  D12: '#ec4899',
};

function groupColor(g: string): string {
  return GROUP_COLORS[g] ?? '#6b7280';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatsPanel({ stats, title }: { stats: CorpusStats; title?: string }) {
  const totalGroups = Object.values(stats.groupDistribution).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}

      {/* Summary numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Files', value: stats.fileCount },
          { label: 'Total Slices', value: stats.totalSlices.toLocaleString() },
          { label: 'Z-Relation Density', value: `${stats.zRelationDensity}%` },
          { label: 'Set Classes Found', value: stats.topSetClasses.length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-white">{value}</div>
            <div className="text-xs text-gray-400 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Average interval vector */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2">Average Interval Vector</h4>
        <div className="flex gap-2">
          {stats.averageIntervalVector.map((v, i) => (
            <div key={i} className="flex-1 bg-gray-800 rounded p-2 text-center">
              <div className="text-sm font-bold text-indigo-400">{v}</div>
              <div className="text-xs text-gray-500">ic{i + 1}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top set classes */}
      {stats.topSetClasses.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Top Set Classes</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs border-b border-gray-700">
                  <th className="text-left py-1 pr-4">Forte</th>
                  <th className="text-right py-1 pr-4">Count</th>
                  <th className="text-right py-1">%</th>
                </tr>
              </thead>
              <tbody>
                {stats.topSetClasses.map(sc => (
                  <tr key={sc.forte} className="border-b border-gray-800">
                    <td className="py-1 pr-4 font-mono text-indigo-400">{sc.forte}</td>
                    <td className="py-1 pr-4 text-right text-gray-300">{sc.count.toLocaleString()}</td>
                    <td className="py-1 text-right text-gray-400">{sc.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Group distribution */}
      {Object.keys(stats.groupDistribution).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Symmetry Group Distribution</h4>
          <div className="space-y-1">
            {Object.entries(stats.groupDistribution)
              .sort((a, b) => b[1] - a[1])
              .map(([group, count]) => {
                const pct = totalGroups > 0 ? Math.round((count / totalGroups) * 100) : 0;
                return (
                  <div key={group} className="flex items-center gap-2">
                    <div className="w-10 text-xs text-right font-mono text-gray-300">{group}</div>
                    <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: groupColor(group) }}
                      />
                    </div>
                    <div className="w-16 text-xs text-right text-gray-400">
                      {count.toLocaleString()} ({pct}%)
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Cardinality distribution */}
      {Object.keys(stats.cardinalityDistribution).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Cardinality Distribution</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.cardinalityDistribution)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([card, count]) => (
                <div key={card} className="bg-gray-800 rounded px-3 py-2 text-center min-w-[3rem]">
                  <div className="text-sm font-bold text-gray-200">{count}</div>
                  <div className="text-xs text-gray-500">{card}-note</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Per-file summary */}
      {stats.perFileSummary.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Per-File Summary</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs border-b border-gray-700">
                  <th className="text-left py-1 pr-4">File</th>
                  <th className="text-right py-1 pr-4">Slices</th>
                  <th className="text-right py-1 pr-4">Top Forte</th>
                  <th className="text-right py-1">Dominant Group</th>
                </tr>
              </thead>
              <tbody>
                {stats.perFileSummary.map(f => (
                  <tr key={f.filename} className="border-b border-gray-800">
                    <td className="py-1 pr-4 text-gray-300 max-w-[180px] truncate" title={f.filename}>
                      {f.filename}
                    </td>
                    <td className="py-1 pr-4 text-right text-gray-400">{f.sliceCount}</td>
                    <td className="py-1 pr-4 text-right font-mono text-indigo-400">{f.topForte || '—'}</td>
                    <td className="py-1 text-right">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-mono text-white"
                        style={{ backgroundColor: groupColor(f.dominantGroup) }}
                      >
                        {f.dominantGroup}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type View = 'upload' | 'results' | 'compare';

export default function CorpusPage() {
  const { user, loading } = useUser();
  const isResearch = user?.tier === 'research';

  const [view, setView] = useState<View>('upload');
  const [corpusName, setCorpusName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [savedCorpora, setSavedCorpora] = useState<CorpusSummary[]>([]);
  const [compareA, setCompareA] = useState<number | ''>('');
  const [compareB, setCompareB] = useState<number | ''>('');
  const [compareResult, setCompareResult] = useState<{ a: CorpusFull; b: CorpusFull } | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCorpora = useCallback(async () => {
    if (!isResearch) return;
    try {
      const res = await fetch(`${API_BASE}/api/corpus`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSavedCorpora(data.corpora ?? []);
      }
    } catch {
      // ignore
    }
  }, [isResearch]);

  useEffect(() => {
    if (isResearch) fetchCorpora();
  }, [isResearch, fetchCorpora]);

  // ── Drag-and-drop handlers ──
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f =>
      /\.(mid|midi|xml|musicxml|mxl|wav)$/i.test(f.name),
    );
    setFiles(prev => [...prev, ...dropped]);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Analyze ──
  async function handleAnalyze() {
    if (files.length === 0) return;
    setAnalyzing(true);
    setError('');
    setProgress(`Uploading ${files.length} file${files.length !== 1 ? 's' : ''}...`);

    const formData = new FormData();
    for (const f of files) formData.append('files', f);
    formData.append('name', corpusName.trim() || `Corpus ${new Date().toLocaleDateString()}`);

    try {
      const res = await fetch(`${API_BASE}/api/corpus/analyze`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Analysis failed');
      } else {
        setResult(data as AnalyzeResult);
        setView('results');
        fetchCorpora();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setAnalyzing(false);
      setProgress('');
    }
  }

  // ── Delete corpus ──
  async function handleDelete(id: number) {
    if (!confirm('Delete this corpus?')) return;
    try {
      await fetch(`${API_BASE}/api/corpus/${id}`, { method: 'DELETE', credentials: 'include' });
      setSavedCorpora(prev => prev.filter(c => c.id !== id));
    } catch {
      // ignore
    }
  }

  // ── Compare ──
  async function handleCompare() {
    if (!compareA || !compareB) return;
    setCompareLoading(true);
    setCompareResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/corpus/compare?a=${compareA}&b=${compareB}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Compare failed');
      } else {
        setCompareResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setCompareLoading(false);
    }
  }

  // ── Loading / gate ──
  if (loading) {
    return <div className="text-center py-16 text-gray-500">Loading…</div>;
  }

  if (!isResearch) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-6">
        <div className="text-5xl">&#128274;</div>
        <h2 className="text-2xl font-bold text-white">Comparative Corpus Analysis</h2>
        <p className="text-gray-400 leading-relaxed">
          Batch upload MIDI, MusicXML, or WAV files to compute aggregate corpus statistics — top
          set classes, symmetry group distributions, cardinality profiles, Z-relation density, and
          averaged interval vectors — then save and compare multiple corpora side by side.
        </p>
        <p className="text-gray-500 text-sm">
          This feature requires a <strong className="text-purple-400">Research</strong> tier subscription.
        </p>
        {/* Play policy: no external purchase links inside the native app */}
        {isNativePlatform ? (
          <p className="text-gray-400 text-sm">
            Available with a Research subscription on the web at symmetry.tendrid.us.
          </p>
        ) : (
          <a
            href="https://symmetry.tendrid.us/pricing"
            className="inline-block px-6 py-3 rounded-lg bg-purple-700 text-white font-semibold hover:bg-purple-600 transition-colors"
          >
            Upgrade to Research
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Tab bar */}
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        {(['upload', 'results', 'compare'] as View[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-t text-sm font-medium capitalize transition-colors ${
              view === v
                ? 'bg-gray-700 text-white border-b-2 border-indigo-500'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {v === 'upload' ? 'Upload & Analyze' : v === 'results' ? 'Results' : 'Compare'}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* ── Upload view ── */}
      {view === 'upload' && (
        <div className="space-y-6">
          {/* Corpus name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Corpus Name</label>
            <input
              type="text"
              value={corpusName}
              onChange={e => setCorpusName(e.target.value)}
              placeholder={`Corpus ${new Date().toLocaleDateString()}`}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragging
                ? 'border-indigo-500 bg-indigo-900/20'
                : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
            }`}
          >
            <div className="text-3xl mb-3">&#127925;</div>
            <p className="text-gray-300 font-medium">Drop MIDI, MusicXML, or WAV files here</p>
            <p className="text-gray-500 text-sm mt-1">or click to browse — up to 100 files</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mid,.midi,.xml,.musicxml,.mxl,.wav"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between bg-gray-800 rounded px-3 py-1.5 text-sm"
                >
                  <span className="text-gray-300 truncate mr-2">{f.name}</span>
                  <span className="text-gray-500 mr-3 shrink-0">
                    {(f.size / 1024).toFixed(1)} KB
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); removeFile(i); }}
                    className="text-gray-500 hover:text-red-400 shrink-0"
                  >
                    &#x2715;
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              onClick={handleAnalyze}
              disabled={analyzing || files.length === 0}
              className="px-6 py-2 rounded-lg bg-indigo-700 text-white font-semibold hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {analyzing ? 'Analyzing…' : `Analyze ${files.length > 0 ? `${files.length} File${files.length !== 1 ? 's' : ''}` : ''}`}
            </button>
            {files.length > 0 && (
              <button
                onClick={() => setFiles([])}
                className="text-sm text-gray-500 hover:text-gray-300"
              >
                Clear all
              </button>
            )}
          </div>

          {progress && <p className="text-sm text-gray-400 animate-pulse">{progress}</p>}

          {/* Saved corpora list */}
          {savedCorpora.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Saved Corpora</h3>
              <div className="space-y-2">
                {savedCorpora.map(c => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3"
                  >
                    <div>
                      <div className="text-white font-medium text-sm">{c.name}</div>
                      <div className="text-gray-500 text-xs mt-0.5">
                        {c.fileCount} file{c.fileCount !== 1 ? 's' : ''} &middot;{' '}
                        {new Date(c.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-gray-600 hover:text-red-400 text-sm transition-colors"
                      title="Delete corpus"
                    >
                      &#128465;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Results view ── */}
      {view === 'results' && (
        <div>
          {result ? (
            <div className="space-y-6">
              {result.errors && result.errors.length > 0 && (
                <div className="bg-yellow-900/40 border border-yellow-700 rounded-lg p-3 text-sm text-yellow-200 space-y-1">
                  <p className="font-medium">Some files could not be parsed:</p>
                  {result.errors.map(e => (
                    <p key={e.filename} className="text-yellow-300">
                      <span className="font-mono">{e.filename}</span>: {e.error}
                    </p>
                  ))}
                </div>
              )}
              <StatsPanel stats={result.stats} title={result.name} />
              {result.corpusId && (
                <p className="text-xs text-gray-500">
                  Corpus saved (ID {result.corpusId}) — use the Compare tab to compare with another corpus.
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500">
              No results yet. Upload and analyze files in the Upload tab.
            </div>
          )}
        </div>
      )}

      {/* ── Compare view ── */}
      {view === 'compare' && (
        <div className="space-y-6">
          {savedCorpora.length < 2 ? (
            <div className="text-center py-16 text-gray-500">
              You need at least 2 saved corpora to compare. Analyze and save more corpora first.
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Corpus A</label>
                  <select
                    value={compareA}
                    onChange={e => setCompareA(Number(e.target.value) || '')}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select corpus…</option>
                    {savedCorpora.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.fileCount} files)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-gray-500 font-bold text-lg hidden sm:block">vs</div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Corpus B</label>
                  <select
                    value={compareB}
                    onChange={e => setCompareB(Number(e.target.value) || '')}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select corpus…</option>
                    {savedCorpora.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.fileCount} files)
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleCompare}
                  disabled={compareLoading || !compareA || !compareB || compareA === compareB}
                  className="px-5 py-2 rounded-lg bg-indigo-700 text-white font-semibold hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {compareLoading ? 'Loading…' : 'Compare'}
                </button>
              </div>

              {compareResult && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-gray-900 rounded-xl p-5 border border-gray-700">
                    <StatsPanel stats={compareResult.a.stats} title={compareResult.a.name} />
                  </div>
                  <div className="bg-gray-900 rounded-xl p-5 border border-gray-700">
                    <StatsPanel stats={compareResult.b.stats} title={compareResult.b.name} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useCallback } from 'react';
import FileUpload from '../components/FileUpload';
import SampleSongs from '../components/SampleSongs';
import TimelineChart from '../components/TimelineChart';
import SliceDetail from '../components/SliceDetail';
import PdfExportButton from '../components/PdfExportButton';
import { useResearchMode } from '../context/ResearchMode';
import type { SliceData } from '../components/TimelineChart';
import { API_BASE } from '../utils/apiBase';

const NOTE_NAMES: Record<number, string> = {
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

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function mapSlices(rawSlices: any[]): SliceData[] {
  return rawSlices.map((s: any) => ({
    startBeat: s.slice.startBeat,
    endBeat: s.slice.endBeat,
    abstractGroup: s.analysis.abstractGroup,
    mullikenLabel: s.analysis.mullikenLabel,
    stabilizerOrder: s.analysis.stabilizerOrder,
    chordName: s.chord ? `${NOTE_NAMES[s.chord.root] ?? '?'} ${s.chord.quality}` : null,
    voiceLeadingFromPrev: s.analysis.voiceLeadingFromPrev ?? null,
  }));
}

export default function AnalyzerPage() {
  const { researchMode } = useResearchMode();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const sliceMode = 'beat';
  const minNotes = 2;

  // Tab state
  const [activeTab, setActiveTab] = useState<'upload' | 'link'>('upload');

  // Link analysis state
  const [linkUrl, setLinkUrl] = useState('');
  const [linkProgress, setLinkProgress] = useState<string[]>([]);

  const handleUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setSelectedIndex(null);
    setCurrentFile(file);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sliceMode', sliceMode);
      formData.append('minNotes', String(minNotes));

      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      setResult({
        filename: data.filename,
        format: data.format,
        totalBeats: data.totalBeats,
        totalMeasures: data.totalMeasures,
        slices: mapSlices(data.slices),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLinkAnalyze = useCallback(async () => {
    if (!linkUrl.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setSelectedIndex(null);
    setCurrentFile(null);
    setLinkProgress([]);

    try {
      const response = await fetch(`${API_BASE}/api/link-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: linkUrl.trim() }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as any).error || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines: each event is "data: {...}\n\n"
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          let parsed: any;
          try {
            parsed = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (parsed.type === 'progress') {
            setLinkProgress(prev => [...prev, parsed.message as string]);
          } else if (parsed.type === 'result') {
            const data = parsed.data;
            setResult({
              filename: data.filename,
              format: data.format,
              totalBeats: data.totalBeats,
              totalMeasures: data.totalMeasures,
              slices: mapSlices(data.slices),
            });
          } else if (parsed.type === 'error') {
            throw new Error(parsed.message as string);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Link analysis failed');
    } finally {
      setIsLoading(false);
    }
  }, [linkUrl]);

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex border-b border-gray-700">
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'upload'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('upload')}
        >
          Upload File
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'link'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('link')}
        >
          Paste Link
        </button>
      </div>

      {activeTab === 'upload' && (
        <>
          <FileUpload onUpload={handleUpload} isLoading={isLoading} />

          {!result && !isLoading && !error && (
            <div className="text-center py-2">
              <p className="text-gray-400 text-sm">Or try one of our sample songs</p>
              <div className="text-gray-500 text-lg leading-none mt-1 animate-bounce">&#8595;</div>
            </div>
          )}

          <SampleSongs onSelect={handleUpload} isLoading={isLoading} />
        </>
      )}

      {activeTab === 'link' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="url"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleLinkAnalyze(); }}
              placeholder="https://www.youtube.com/watch?v=... or https://open.spotify.com/track/..."
              disabled={isLoading}
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
            <button
              onClick={handleLinkAnalyze}
              disabled={isLoading || !linkUrl.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            YouTube and Spotify links supported. Requires yt-dlp on the server. Audio is fetched server-side and not stored.
          </p>

          {linkProgress.length > 0 && (
            <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-400 max-h-32 overflow-y-auto space-y-0.5">
              {linkProgress.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {result && (
        <>
          <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase">
                Timeline — {result.filename}
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  {result.totalBeats} beats · {result.totalMeasures} measures · {result.slices.length} slices
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      const headers = ['beat_start', 'beat_end', 'group', 'mulliken', 'stabilizer', 'chord', 'vl_distance'];
                      const rows = result.slices.map(s =>
                        [s.startBeat, s.endBeat, s.abstractGroup, s.mullikenLabel, s.stabilizerOrder, s.chordName ?? '', s.voiceLeadingFromPrev ?? ''].join(',')
                      );
                      downloadFile([headers.join(','), ...rows].join('\n'), `${result.filename}-analysis.csv`, 'text/csv');
                    }}
                    className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => {
                      downloadFile(JSON.stringify({ ...result, exportedAt: new Date().toISOString() }, null, 2), `${result.filename}-analysis.json`, 'application/json');
                    }}
                    className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600"
                  >
                    JSON
                  </button>
                  {currentFile && (
                    <PdfExportButton
                      file={currentFile}
                      sliceMode={sliceMode}
                      minNotes={minNotes}
                    />
                  )}
                </div>
              </div>
            </div>
            {researchMode && (
              <div className="flex items-center gap-4 mb-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-0.5 bg-orange-500"></span> Voice-leading distance
                </span>
              </div>
            )}
            <TimelineChart
              slices={result.slices}
              onSelectSlice={setSelectedIndex}
              selectedIndex={selectedIndex}
              showVoiceLeading={researchMode}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <SliceDetail
              slice={selectedIndex !== null ? result.slices[selectedIndex] ?? null : null}
              index={selectedIndex}
            />
            <div className="lg:col-span-2 bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Group Distribution</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(
                  result.slices.reduce<Record<string, number>>((acc, s) => {
                    acc[s.abstractGroup] = (acc[s.abstractGroup] ?? 0) + 1;
                    return acc;
                  }, {})
                ).sort((a, b) => b[1] - a[1]).map(([group, count]) => (
                  <span key={group} className="px-2 py-1 rounded bg-gray-700 text-xs font-mono">
                    {group}: {count}
                  </span>
                ))}
              </div>

              {researchMode && (() => {
                const vlValues = result.slices
                  .map(s => s.voiceLeadingFromPrev)
                  .filter((v): v is number => v !== null);
                if (vlValues.length === 0) return null;
                const mean = vlValues.reduce((a, b) => a + b, 0) / vlValues.length;
                const smooth = vlValues.filter(v => v <= 2).length;
                const leaps = vlValues.filter(v => v > 4).length;
                return (
                  <div className="mt-4 pt-3 border-t border-gray-700">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Voice-Leading Stats</h4>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-gray-900 rounded p-2">
                        <div className="text-lg font-bold text-orange-400">{mean.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">Mean VL</div>
                      </div>
                      <div className="bg-gray-900 rounded p-2">
                        <div className="text-lg font-bold text-green-400">{Math.round(smooth / vlValues.length * 100)}%</div>
                        <div className="text-xs text-gray-500">Smooth (≤2)</div>
                      </div>
                      <div className="bg-gray-900 rounded p-2">
                        <div className="text-lg font-bold text-red-400">{Math.round(leaps / vlValues.length * 100)}%</div>
                        <div className="text-xs text-gray-500">Leaps (&gt;4)</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

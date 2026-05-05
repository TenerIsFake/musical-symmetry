import { useState, useCallback } from 'react';
import FileUpload from '../components/FileUpload';
import TimelineChart from '../components/TimelineChart';
import SliceDetail from '../components/SliceDetail';
import type { SliceData } from '../components/TimelineChart';

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

export default function AnalyzerPage() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setSelectedIndex(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sliceMode', 'beat');
      formData.append('minNotes', '2');

      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

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
        chordName: s.chord ? `${NOTE_NAMES[s.chord.root] ?? '?'} ${s.chord.quality}` : null,
      }));

      setResult({
        filename: data.filename,
        format: data.format,
        totalBeats: data.totalBeats,
        totalMeasures: data.totalMeasures,
        slices,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <FileUpload onUpload={handleUpload} isLoading={isLoading} />

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {result && (
        <>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase">
                Timeline — {result.filename}
              </h2>
              <span className="text-xs text-gray-500">
                {result.totalBeats} beats · {result.totalMeasures} measures · {result.slices.length} slices
              </span>
            </div>
            <TimelineChart
              slices={result.slices}
              onSelectSlice={setSelectedIndex}
              selectedIndex={selectedIndex}
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}

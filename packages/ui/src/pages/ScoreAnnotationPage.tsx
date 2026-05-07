import { useState, useRef, useCallback } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { classify, NOTE_NAMES } from '@musical-symmetry/core';
import { forteNumber } from '../data/forte-numbers';
import { downloadAsFile } from '../utils/export-academic';
import { useUser } from '../context/UserContext';
import { parseMusicXML } from '../utils/musicxml-parser';
import type { MusicXMLMeasure } from '../utils/musicxml-parser';

// ─── Constants ────────────────────────────────────────────────────────────────

const FREE_MEASURE_LIMIT = 16;
const PRO_MEASURE_LIMIT = 100;

const GROUP_COLORS: Record<string, string> = {
  C1: '#6b7280',
  Z2: '#8b5cf6',
  C2: '#3b82f6',
  C3: '#06b6d4',
  C4: '#10b981',
  C6: '#22c55e',
  D2: '#eab308',
  D3: '#f97316',
  D4: '#ef4444',
  D6: '#dc2626',
  D12: '#ec4899',
};

function groupColor(group: string): string {
  return GROUP_COLORS[group] ?? '#6b7280';
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnnotatedMeasure extends MusicXMLMeasure {
  forteNumber: string;
  group: string;
  intervalVector: number[];
  annotation: string;
}

// ─── Analysis helper ──────────────────────────────────────────────────────────

function analyzeMeasure(measure: MusicXMLMeasure): AnnotatedMeasure {
  const pcs = measure.pitchClasses as PitchClass[];

  if (pcs.length === 0) {
    return {
      ...measure,
      forteNumber: '—',
      group: 'C1',
      intervalVector: [0, 0, 0, 0, 0, 0],
      annotation: '',
    };
  }

  const analysis = classify(pcs);

  return {
    ...measure,
    forteNumber: forteNumber(pcs as PitchClass[]) ?? '—',
    group: analysis.abstractGroup ?? 'C1',
    intervalVector: analysis.intervalVector,
    annotation: '',
  };
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function buildCsv(measures: AnnotatedMeasure[], filename: string): string {
  const header = 'measure,pitch_classes,forte_number,symmetry_group,interval_vector,annotation';
  const rows = measures.map((m) => {
    const pcsStr = `"${m.pitchClasses.map((p) => NOTE_NAMES[p as PitchClass]).join(' ')}"`;
    const ivStr = `"[${m.intervalVector.join(',')}]"`;
    const ann = `"${m.annotation.replace(/"/g, '""')}"`;
    return [m.number, pcsStr, m.forteNumber, m.group, ivStr, ann].join(',');
  });
  return [
    `# Score annotation export — ${filename}`,
    header,
    ...rows,
  ].join('\n');
}

// ─── LaTeX Export ─────────────────────────────────────────────────────────────

function buildLatex(measures: AnnotatedMeasure[], filename: string): string {
  const safeFilename = filename.replace(/[_#%&{}\\^~[\]]/g, ' ');
  const rows = measures
    .map((m) => {
      const pcsStr = m.pitchClasses.map((p) => NOTE_NAMES[p as PitchClass]).join(', ');
      const ivStr = `\\langle ${m.intervalVector.join(', ')} \\rangle`;
      const ann = m.annotation.replace(/[_#%&{}\\^~[\]]/g, '\\$&');
      return `    ${m.number} & $\\{${pcsStr}\\}$ & ${m.forteNumber} & $${m.group}$ & $${ivStr}$ & ${ann} \\\\`;
    })
    .join('\n');

  return [
    '\\documentclass{article}',
    '\\usepackage{booktabs}',
    '\\usepackage{longtable}',
    '\\usepackage{geometry}',
    '\\geometry{margin=1in}',
    '',
    `\\title{Score Annotation: ${safeFilename}}`,
    `\\date{${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}}`,
    '',
    '\\begin{document}',
    '\\maketitle',
    '',
    '\\begin{longtable}{rllllp{5cm}}',
    '\\toprule',
    'Measure & Pitch Classes & Forte & Group & IV & Annotation \\\\',
    '\\midrule',
    '\\endhead',
    rows,
    '\\bottomrule',
    '\\end{longtable}',
    '',
    '\\end{document}',
  ].join('\n');
}

// ─── Formatted text Export ────────────────────────────────────────────────────

function buildFormattedText(measures: AnnotatedMeasure[], filename: string): string {
  const lines: string[] = [
    `Score Annotation: ${filename}`,
    '='.repeat(60),
    '',
  ];

  for (const m of measures) {
    const pcsStr = m.pitchClasses.map((p) => NOTE_NAMES[p as PitchClass]).join(' ');
    lines.push(`Measure ${m.number}`);
    lines.push(`  Pitch classes : ${pcsStr || '(rest)'}`);
    lines.push(`  Forte number  : ${m.forteNumber}`);
    lines.push(`  Symmetry group: ${m.group}`);
    lines.push(`  Interval vec  : [${m.intervalVector.join(',')}]`);
    if (m.annotation) {
      lines.push(`  Annotation    : ${m.annotation}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Measure card ─────────────────────────────────────────────────────────────

interface MeasureCardProps {
  measure: AnnotatedMeasure;
  selected: boolean;
  onClick: () => void;
}

function MeasureCard({ measure, selected, onClick }: MeasureCardProps) {
  const color = groupColor(measure.group);
  const pcsStr = measure.pitchClasses.map((p) => NOTE_NAMES[p as PitchClass]).join(' ');

  return (
    <button
      onClick={onClick}
      className={[
        'flex flex-col items-start text-left p-3 rounded-lg border transition-all w-full',
        selected
          ? 'border-indigo-500 bg-indigo-950/60 ring-1 ring-indigo-500'
          : 'border-gray-700 bg-gray-800 hover:border-gray-500',
      ].join(' ')}
    >
      {/* Color bar top */}
      <div className="w-full h-1 rounded-full mb-2" style={{ backgroundColor: color }} />

      <div className="flex items-center gap-2 mb-1 w-full">
        <span className="text-xs font-mono text-gray-400">M{measure.number}</span>
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded text-white ml-auto"
          style={{ backgroundColor: color }}
        >
          {measure.group}
        </span>
      </div>

      <div className="text-xs text-white font-mono mb-1 truncate w-full">
        {pcsStr || <span className="text-gray-500 italic">rest</span>}
      </div>

      <div className="text-xs text-gray-500 font-mono">{measure.forteNumber}</div>

      {measure.annotation && (
        <div className="mt-1 text-xs text-indigo-300 italic truncate w-full">
          {measure.annotation}
        </div>
      )}
    </button>
  );
}

// ─── Annotation panel ─────────────────────────────────────────────────────────

interface AnnotationPanelProps {
  measure: AnnotatedMeasure;
  onAnnotationChange: (text: string) => void;
}

function AnnotationPanel({ measure, onAnnotationChange }: AnnotationPanelProps) {
  const pcsStr = measure.pitchClasses.map((p) => NOTE_NAMES[p as PitchClass]).join(' ');
  const color = groupColor(measure.group);

  return (
    <div className="bg-gray-800 rounded-xl p-5 space-y-4 border border-gray-700">
      <div className="flex items-center gap-3">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <h3 className="text-white font-semibold text-base">Measure {measure.number}</h3>
        <span
          className="ml-auto px-2 py-0.5 rounded text-xs font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {measure.group}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-gray-900 rounded-lg p-3">
          <div className="text-gray-400 text-xs mb-1">Pitch Classes</div>
          <div className="text-white font-mono">{pcsStr || '(rest)'}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-3">
          <div className="text-gray-400 text-xs mb-1">Forte Number</div>
          <div className="text-white font-mono">{measure.forteNumber}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-3">
          <div className="text-gray-400 text-xs mb-1">Symmetry Group</div>
          <div className="text-white font-mono">{measure.group}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-3">
          <div className="text-gray-400 text-xs mb-1">Interval Vector</div>
          <div className="text-white font-mono text-xs">[{measure.intervalVector.join(',')}]</div>
        </div>
      </div>

      {measure.notes.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-3">
          <div className="text-gray-400 text-xs mb-2">Notes ({measure.notes.length})</div>
          <div className="flex flex-wrap gap-1">
            {measure.notes.slice(0, 24).map((note, i) => (
              <span
                key={i}
                className={[
                  'px-1.5 py-0.5 rounded text-xs font-mono',
                  note.isRest
                    ? 'bg-gray-700 text-gray-500 italic'
                    : 'bg-gray-700 text-gray-200',
                ].join(' ')}
              >
                {note.isRest ? 'rest' : NOTE_NAMES[((note.pitch % 12) + 12) % 12 as PitchClass]}
              </span>
            ))}
            {measure.notes.length > 24 && (
              <span className="text-gray-500 text-xs px-1">+{measure.notes.length - 24} more</span>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="text-xs text-gray-400 block mb-1">Annotation</label>
        <textarea
          value={measure.annotation}
          onChange={(e) => onAnnotationChange(e.target.value)}
          rows={4}
          placeholder="Add your analysis notes here…"
          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>
    </div>
  );
}

// ─── Group legend ─────────────────────────────────────────────────────────────

function GroupLegend({ measures }: { measures: AnnotatedMeasure[] }) {
  const counts = measures.reduce<Record<string, number>>((acc, m) => {
    acc[m.group] = (acc[m.group] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Group Distribution
      </h3>
      <div className="flex flex-wrap gap-2">
        {Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([group, count]) => (
            <span
              key={group}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: groupColor(group) + 'cc' }}
            >
              {group}
              <span className="opacity-80 font-normal">×{count}</span>
            </span>
          ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ScoreAnnotationPage() {
  const { user } = useUser();
  const tier = user?.tier ?? 'free';
  const isPro = tier === 'pro' || tier === 'research';
  const isResearch = tier === 'research';

  const measureLimit = isResearch ? Infinity : isPro ? PRO_MEASURE_LIMIT : FREE_MEASURE_LIMIT;

  const [measures, setMeasures] = useState<AnnotatedMeasure[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [filename, setFilename] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setMeasures([]);
    setSelectedIdx(null);
    setFilename(file.name);

    try {
      const text = await file.text();
      const parsed = parseMusicXML(text);

      if (parsed.length === 0) {
        setError('No measures found in the MusicXML file. Make sure it uses <measure> elements.');
        return;
      }

      const limit = measureLimit === Infinity ? parsed.length : measureLimit;
      const truncated = parsed.slice(0, limit);
      const annotated = truncated.map(analyzeMeasure);
      setMeasures(annotated);

      if (parsed.length > limit) {
        setError(
          `File has ${parsed.length} measures — showing first ${limit}. Upgrade to ${isPro ? 'Research' : 'Pro'} for more.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse MusicXML file.');
    }
  }, [measureLimit, isPro]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xml') || file.name.endsWith('.musicxml'))) {
      handleFile(file);
    } else {
      setError('Please drop a .xml or .musicxml file.');
    }
  };

  const updateAnnotation = (idx: number, text: string) => {
    setMeasures((prev) => {
      const next = [...prev];
      const m = next[idx];
      if (m) next[idx] = { ...m, annotation: text };
      return next;
    });
  };

  const handleCopyText = async () => {
    const text = buildFormattedText(measures, filename);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Clipboard access denied.');
    }
  };

  const selectedMeasure = selectedIdx !== null ? measures[selectedIdx] ?? null : null;

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={[
          'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer',
          isDragging
            ? 'border-indigo-500 bg-indigo-950/30'
            : 'border-gray-600 bg-gray-800/40 hover:border-gray-500',
        ].join(' ')}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml,.musicxml"
          className="hidden"
          onChange={handleInputChange}
        />
        <div className="text-4xl mb-3">&#9835;</div>
        <p className="text-white font-medium mb-1">
          {measures.length > 0 ? `Loaded: ${filename}` : 'Drop a MusicXML file here'}
        </p>
        <p className="text-gray-400 text-sm">
          {measures.length > 0
            ? `${measures.length} measures · click to replace`
            : 'Accepts .xml and .musicxml — or click to browse'}
        </p>
        {!isPro && (
          <p className="text-xs text-gray-500 mt-2">
            Free: up to {FREE_MEASURE_LIMIT} measures ·{' '}
            <a href="#dashboard" className="text-indigo-400 hover:underline" onClick={(e) => e.stopPropagation()}>
              Upgrade for more
            </a>
          </p>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {measures.length > 0 && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <span className="text-white font-semibold">{filename}</span>
              <span className="text-gray-400 text-sm ml-2">
                {measures.length} measure{measures.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex-1" />

            {/* Tier badge */}
            <span
              className={[
                'px-2 py-0.5 rounded text-xs font-medium',
                isResearch
                  ? 'bg-purple-900/60 text-purple-300'
                  : isPro
                  ? 'bg-indigo-900/60 text-indigo-300'
                  : 'bg-gray-700 text-gray-400',
              ].join(' ')}
            >
              {tier}
            </span>

            {/* CSV download — Pro+ */}
            {isPro ? (
              <button
                onClick={() =>
                  downloadAsFile(buildCsv(measures, filename), `${filename}-annotation.csv`, 'text/csv')
                }
                className="px-3 py-1.5 rounded text-sm font-medium bg-teal-700 hover:bg-teal-600 text-white transition-colors"
              >
                &#x2913; CSV
              </button>
            ) : (
              <button
                disabled
                title="Pro required for CSV export"
                className="px-3 py-1.5 rounded text-sm font-medium bg-gray-700 text-gray-500 cursor-not-allowed"
              >
                &#x2913; CSV (Pro)
              </button>
            )}

            {/* LaTeX download — Research */}
            {isResearch ? (
              <button
                onClick={() =>
                  downloadAsFile(
                    buildLatex(measures, filename),
                    `${filename}-annotation.tex`,
                    'text/x-tex'
                  )
                }
                className="px-3 py-1.5 rounded text-sm font-medium bg-purple-700 hover:bg-purple-600 text-white transition-colors"
              >
                &#x2907; LaTeX
              </button>
            ) : (
              <button
                disabled
                title="Research tier required for LaTeX export"
                className="px-3 py-1.5 rounded text-sm font-medium bg-gray-700 text-gray-500 cursor-not-allowed"
              >
                &#x2907; LaTeX (Research)
              </button>
            )}

            {/* Copy text — Research */}
            {isResearch ? (
              <button
                onClick={handleCopyText}
                className="px-3 py-1.5 rounded text-sm font-medium bg-purple-700 hover:bg-purple-600 text-white transition-colors"
              >
                {copied ? '&#x2713; Copied' : '&#x2398; Copy Text'}
              </button>
            ) : (
              <button
                disabled
                title="Research tier required for formatted text export"
                className="px-3 py-1.5 rounded text-sm font-medium bg-gray-700 text-gray-500 cursor-not-allowed"
              >
                &#x2398; Copy (Research)
              </button>
            )}
          </div>

          {/* Group distribution */}
          <GroupLegend measures={measures} />

          {/* Score strip + annotation panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score strip */}
            <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-700 p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Score Strip — click a measure to annotate
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto pr-1">
                {measures.map((m, idx) => (
                  <MeasureCard
                    key={m.number}
                    measure={m}
                    selected={selectedIdx === idx}
                    onClick={() => setSelectedIdx(idx === selectedIdx ? null : idx)}
                  />
                ))}
              </div>
            </div>

            {/* Annotation panel */}
            <div className="lg:col-span-1">
              {selectedMeasure !== null && selectedIdx !== null ? (
                <AnnotationPanel
                  measure={selectedMeasure}
                  onAnnotationChange={(text) => updateAnnotation(selectedIdx, text)}
                />
              ) : (
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
                  <div className="text-3xl mb-3 text-gray-600">&#9881;</div>
                  <p className="text-gray-400 text-sm">
                    Click any measure card to view its analysis and add annotations.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Annotation list (non-empty only) */}
          {measures.some((m) => m.annotation) && (
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Annotations Summary
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {measures
                  .filter((m) => m.annotation)
                  .map((m) => (
                    <div
                      key={m.number}
                      className="flex items-start gap-3 px-3 py-2 rounded-lg bg-gray-700/50"
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1"
                        style={{ backgroundColor: groupColor(m.group) }}
                      />
                      <span className="text-gray-400 text-xs font-mono w-10 flex-shrink-0">
                        M{m.number}
                      </span>
                      <span className="text-white text-sm flex-1 min-w-0">{m.annotation}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {measures.length === 0 && !error && (
        <div className="text-center py-16 text-gray-500 text-sm space-y-2">
          <p>No file loaded. Upload a MusicXML file to begin annotating.</p>
          <p className="text-xs">
            MusicXML files (.xml / .musicxml) are exported by notation software such as
            MuseScore, Finale, Sibelius, and Dorico.
          </p>
        </div>
      )}
    </div>
  );
}

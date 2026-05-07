import { useState, useRef, useCallback, useEffect } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { classify, identifyChord, NOTE_NAMES } from '@musical-symmetry/core';
import { useUser } from '../context/UserContext';

// ─── Constants ────────────────────────────────────────────────────────────────

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

const FREE_SLOT_LIMIT = 8;
const PRO_SLOT_LIMIT = 32;

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimelineSlot {
  id: string;
  pcs: PitchClass[];
  chordName: string | null;
  group: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function analyzeSlot(pcs: PitchClass[]): { chordName: string | null; group: string } {
  if (pcs.length === 0) return { chordName: null, group: 'C1' };
  const analysis = classify(pcs);
  const chord = identifyChord(pcs);
  const qualityLabel: Record<string, string> = {
    major: '',
    minor: 'm',
    diminished: 'dim',
    augmented: 'aug',
  };
  const chordName = chord
    ? `${NOTE_NAMES[chord.root]}${qualityLabel[chord.quality] ?? chord.quality}`
    : null;
  const group = analysis.abstractGroup ?? 'C1';
  return { chordName, group };
}

// ─── Mini Chord Classifier Modal ──────────────────────────────────────────────

interface AddChordModalProps {
  onAdd: (pcs: PitchClass[]) => void;
  onClose: () => void;
}

function AddChordModal({ onAdd, onClose }: AddChordModalProps) {
  const [selected, setSelected] = useState<Set<PitchClass>>(new Set());

  const togglePC = (pc: PitchClass) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(pc)) {
        next.delete(pc);
      } else {
        next.add(pc);
      }
      return next;
    });
  };

  const pcs = [...selected].sort((a, b) => a - b) as PitchClass[];
  const chord = pcs.length > 0 ? identifyChord(pcs) : null;
  const qualityLabel: Record<string, string> = { major: '', minor: 'm', diminished: 'dim', augmented: 'aug' };
  const chordName = chord ? `${NOTE_NAMES[chord.root]}${qualityLabel[chord.quality] ?? chord.quality}` : null;
  const group = pcs.length > 0 ? (classify(pcs).abstractGroup ?? 'C1') : null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-xl p-5 w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">Add Chord / Sonority</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&#x2715;</button>
        </div>

        {/* PC grid */}
        <div className="grid grid-cols-6 gap-2 mb-4">
          {(Array.from({ length: 12 }, (_, i) => i) as PitchClass[]).map(pc => (
            <button
              key={pc}
              onClick={() => togglePC(pc)}
              className={[
                'rounded py-2 text-sm font-medium transition-colors',
                selected.has(pc)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600',
              ].join(' ')}
            >
              {NOTE_NAMES[pc]}
            </button>
          ))}
        </div>

        {/* Preview */}
        {pcs.length > 0 && (
          <div className="mb-4 p-3 bg-gray-700/60 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              {group && (
                <span
                  className="px-2 py-0.5 rounded text-xs font-bold text-white"
                  style={{ backgroundColor: groupColor(group) }}
                >
                  {group}
                </span>
              )}
              {chordName && (
                <span className="text-white font-semibold">{chordName}</span>
              )}
            </div>
            <div className="text-gray-400 text-xs font-mono">
              {pcs.map(p => NOTE_NAMES[p]).join(' ')}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { if (pcs.length > 0) { onAdd(pcs); onClose(); } }}
            disabled={pcs.length === 0}
            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded font-medium transition-colors"
          >
            Add to Timeline
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Slot Popup ───────────────────────────────────────────────────────────────

interface SlotPopupProps {
  slot: TimelineSlot;
  x: number;
  y: number;
  onClose: () => void;
}

function SlotPopup({ slot, x, y, onClose }: SlotPopupProps) {
  const analysis = slot.pcs.length > 0 ? classify(slot.pcs) : null;

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute bg-gray-800 border border-gray-600 rounded-xl p-4 shadow-2xl w-64 z-50"
        style={{ left: Math.min(x, window.innerWidth - 280), top: Math.min(y, window.innerHeight - 300) }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs font-bold text-white"
              style={{ backgroundColor: groupColor(slot.group) }}
            >
              {slot.group}
            </span>
            {slot.chordName && (
              <span className="text-white font-semibold text-sm">{slot.chordName}</span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">&#x2715;</button>
        </div>
        <div className="space-y-2 text-xs">
          <div>
            <span className="text-gray-400">Pitch Classes: </span>
            <span className="text-white font-mono">{slot.pcs.map(p => NOTE_NAMES[p]).join(' ')}</span>
          </div>
          {analysis && (
            <>
              <div>
                <span className="text-gray-400">Symmetry Group: </span>
                <span className="text-white font-mono">{slot.group}</span>
              </div>
              <div>
                <span className="text-gray-400">Cardinality: </span>
                <span className="text-white">{slot.pcs.length} notes</span>
              </div>
              <div>
                <span className="text-gray-400">Interval Vector: </span>
                <span className="text-white font-mono">[{analysis.intervalVector.join(',')}]</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SVG Timeline ─────────────────────────────────────────────────────────────

const SLOT_W = 110;
const SLOT_H = 90;
const SLOT_GAP = 16;
const PADDING = 20;
const MAP_H = 24;
const MAP_GAP = 8;

interface SvgTimelineProps {
  slots: TimelineSlot[];
  draggingIdx: number | null;
  dragOverIdx: number | null;
  onDragStart: (idx: number) => void;
  onDragOver: (idx: number) => void;
  onDrop: (idx: number) => void;
  onDragEnd: () => void;
  onHover: (idx: number | null, x: number, y: number) => void;
}

function SvgTimeline({
  slots,
  draggingIdx,
  dragOverIdx,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onHover,
}: SvgTimelineProps) {
  const totalW = PADDING * 2 + slots.length * (SLOT_W + SLOT_GAP) + SLOT_GAP;
  const svgH = PADDING + SLOT_H + MAP_GAP + MAP_H + PADDING;

  // Group runs for connector bars
  type Run = { group: string; startX: number; endX: number };
  const runs: Run[] = [];
  let runStart = 0;
  for (let i = 1; i <= slots.length; i++) {
    if (i === slots.length || slots[i]!.group !== slots[runStart]!.group) {
      if (i - runStart > 1) {
        const sx = PADDING + runStart * (SLOT_W + SLOT_GAP) + SLOT_W / 2;
        const ex = PADDING + (i - 1) * (SLOT_W + SLOT_GAP) + SLOT_W / 2;
        runs.push({ group: slots[runStart]!.group, startX: sx, endX: ex });
      }
      runStart = i;
    }
  }

  return (
    <svg
      width={Math.max(totalW, 400)}
      height={svgH}
      className="block"
      style={{ cursor: 'default' }}
    >
      {/* Connector bars between same-group slots */}
      {runs.map((run, ri) => (
        <rect
          key={`run-${ri}`}
          x={run.startX}
          y={PADDING + SLOT_H / 2 - 3}
          width={run.endX - run.startX}
          height={6}
          rx={3}
          fill={groupColor(run.group)}
          opacity={0.35}
        />
      ))}

      {/* Slots */}
      {slots.map((slot, idx) => {
        const x = PADDING + idx * (SLOT_W + SLOT_GAP);
        const y = PADDING;
        const color = groupColor(slot.group);
        const isDragging = draggingIdx === idx;
        const isDragOver = dragOverIdx === idx && draggingIdx !== idx;

        return (
          <g
            key={slot.id}
            transform={`translate(${x},${y})`}
            onMouseDown={() => onDragStart(idx)}
            onMouseUp={() => onDrop(idx)}
            onMouseEnter={e => { onDragOver(idx); onHover(idx, e.clientX, e.clientY + 20); }}
            onMouseLeave={() => { onDragEnd(); onHover(null, 0, 0); }}
            style={{ opacity: isDragging ? 0.35 : 1, cursor: 'grab' }}
          >
            {/* Card background */}
            <rect
              width={SLOT_W}
              height={SLOT_H}
              rx={8}
              fill={isDragOver ? '#312e81' : '#1f2937'}
              stroke={isDragOver ? '#facc15' : color}
              strokeWidth={isDragOver ? 2.5 : 1.5}
            />
            {/* Color bar at top */}
            <rect x={0} y={0} width={SLOT_W} height={6} rx={4} fill={color} />
            {/* Index label */}
            <text x={8} y={22} fontSize={10} fill="#9ca3af" fontFamily="monospace">
              #{idx + 1}
            </text>
            {/* Group badge */}
            <rect x={SLOT_W - 36} y={10} width={28} height={14} rx={4} fill={color} />
            <text x={SLOT_W - 22} y={21} fontSize={9} fill="white" textAnchor="middle" fontWeight="bold">
              {slot.group}
            </text>
            {/* Chord name */}
            <text
              x={SLOT_W / 2}
              y={44}
              fontSize={12}
              fill="white"
              textAnchor="middle"
              fontWeight="600"
              style={{ overflow: 'hidden' }}
            >
              {slot.chordName ? slot.chordName.slice(0, 10) : '{' + slot.pcs.slice(0, 4).join(',') + (slot.pcs.length > 4 ? '…' : '') + '}'}
            </text>
            {/* PC names */}
            <text x={SLOT_W / 2} y={60} fontSize={9} fill="#9ca3af" textAnchor="middle" fontFamily="monospace">
              {slot.pcs.map(p => NOTE_NAMES[p]).join(' ').slice(0, 16)}
            </text>
            {/* Drag hint */}
            <text x={SLOT_W / 2} y={80} fontSize={8} fill="#4b5563" textAnchor="middle">
              drag to reorder
            </text>
          </g>
        );
      })}

      {/* Symmetry map strip */}
      {slots.length > 0 && (
        <g transform={`translate(${PADDING},${PADDING + SLOT_H + MAP_GAP})`}>
          {slots.map((slot, idx) => {
            const x = idx * (SLOT_W + SLOT_GAP);
            return (
              <rect
                key={`map-${slot.id}`}
                x={x}
                y={0}
                width={SLOT_W}
                height={MAP_H}
                rx={4}
                fill={groupColor(slot.group)}
                opacity={0.8}
              />
            );
          })}
          {/* Map label */}
          <text x={0} y={MAP_H + 14} fontSize={9} fill="#6b7280">
            Symmetry map
          </text>
        </g>
      )}
    </svg>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

interface StatsBarProps {
  slots: TimelineSlot[];
}

function StatsBar({ slots }: StatsBarProps) {
  const uniqueGroups = new Set(slots.map(s => s.group)).size;
  const groupCounts = slots.reduce<Record<string, number>>((acc, s) => {
    acc[s.group] = (acc[s.group] ?? 0) + 1;
    return acc;
  }, {});
  const mostCommon = Object.entries(groupCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  let transitions = 0;
  for (let i = 1; i < slots.length; i++) {
    if (slots[i]!.group !== slots[i - 1]!.group) transitions++;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total Slots', value: String(slots.length) },
        { label: 'Unique Groups', value: String(uniqueGroups) },
        { label: 'Most Common', value: mostCommon },
        { label: 'Group Transitions', value: String(transitions) },
      ].map(stat => (
        <div key={stat.label} className="bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-white font-mono">{stat.value}</div>
          <div className="text-xs text-gray-400 mt-0.5">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCsv(slots: TimelineSlot[]) {
  const header = 'index,pitchClasses,chordName,symmetryGroup\n';
  const rows = slots
    .map(
      (s, i) =>
        `${i + 1},"${s.pcs.map(p => NOTE_NAMES[p]).join(' ')}","${s.chordName ?? ''}","${s.group}"`,
    )
    .join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'harmony-timeline.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── SVG Export ───────────────────────────────────────────────────────────────

function exportSvg(slots: TimelineSlot[]) {
  const totalW = Math.max(PADDING * 2 + slots.length * (SLOT_W + SLOT_GAP) + SLOT_GAP, 400);
  const svgH = PADDING + SLOT_H + MAP_GAP + MAP_H + PADDING + 30;

  const slotRects = slots
    .map((slot, idx) => {
      const x = PADDING + idx * (SLOT_W + SLOT_GAP);
      const color = groupColor(slot.group);
      return `
      <g transform="translate(${x},${PADDING})">
        <rect width="${SLOT_W}" height="${SLOT_H}" rx="8" fill="#1f2937" stroke="${color}" stroke-width="1.5"/>
        <rect x="0" y="0" width="${SLOT_W}" height="6" rx="4" fill="${color}"/>
        <text x="8" y="22" font-size="10" fill="#9ca3af" font-family="monospace">#${idx + 1}</text>
        <rect x="${SLOT_W - 36}" y="10" width="28" height="14" rx="4" fill="${color}"/>
        <text x="${SLOT_W - 22}" y="21" font-size="9" fill="white" text-anchor="middle" font-weight="bold">${slot.group}</text>
        <text x="${SLOT_W / 2}" y="44" font-size="12" fill="white" text-anchor="middle" font-weight="600">${(slot.chordName ?? '{' + slot.pcs.join(',') + '}').slice(0, 10)}</text>
        <text x="${SLOT_W / 2}" y="60" font-size="9" fill="#9ca3af" text-anchor="middle" font-family="monospace">${slot.pcs.map(p => NOTE_NAMES[p]).join(' ').slice(0, 16)}</text>
      </g>`;
    })
    .join('\n');

  const mapRects = slots
    .map((slot, idx) => {
      const x = PADDING + idx * (SLOT_W + SLOT_GAP);
      return `<rect x="${x}" y="${PADDING + SLOT_H + MAP_GAP}" width="${SLOT_W}" height="${MAP_H}" rx="4" fill="${groupColor(slot.group)}" opacity="0.8"/>`;
    })
    .join('\n');

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${svgH}" style="background:#111827">
  ${slotRects}
  ${mapRects}
  <text x="${PADDING}" y="${PADDING + SLOT_H + MAP_GAP + MAP_H + 14}" font-size="9" fill="#6b7280">Symmetry map</text>
</svg>`;

  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'harmony-timeline.svg';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Import from Analyzer result ─────────────────────────────────────────────

async function importFromFile(
  file: File,
  onSlots: (slots: TimelineSlot[]) => void,
  onError: (msg: string) => void,
) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Accept: { slices: [{ pitchClasses: number[] }] } or array of same
    const slices: { pitchClasses?: number[]; pcs?: number[] }[] = Array.isArray(data)
      ? data
      : data.slices ?? data.results ?? [];

    if (slices.length === 0) {
      onError('No pitch-class slices found in file.');
      return;
    }

    const newSlots: TimelineSlot[] = slices.slice(0, 64).map(s => {
      const pcs = ((s.pitchClasses ?? s.pcs ?? []) as number[])
        .filter(n => n >= 0 && n <= 11) as PitchClass[];
      const { chordName, group } = analyzeSlot(pcs);
      return { id: uid(), pcs, chordName, group };
    });

    onSlots(newSlots);
  } catch {
    onError('Could not parse file. Expected JSON with a "slices" array.');
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const { user } = useUser();
  const tier = user?.tier ?? 'free';
  const isPro = tier === 'pro' || tier === 'research';
  const isResearch = tier === 'research';

  const slotLimit = isResearch ? Infinity : isPro ? PRO_SLOT_LIMIT : FREE_SLOT_LIMIT;

  const [slots, setSlots] = useState<TimelineSlot[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [popup, setPopup] = useState<{ slot: TimelineSlot; x: number; y: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const atLimit = slots.length >= slotLimit;

  const handleAddSlot = useCallback((pcs: PitchClass[]) => {
    if (atLimit) return;
    const { chordName, group } = analyzeSlot(pcs);
    const slot: TimelineSlot = { id: uid(), pcs, chordName, group };
    setSlots(prev => [...prev, slot]);
  }, [atLimit]);

  const removeSlot = (id: string) => {
    setSlots(prev => prev.filter(s => s.id !== id));
    setPopup(null);
  };

  // Drag handlers
  const onDragStart = (idx: number) => {
    setDraggingIdx(idx);
  };
  const onDragOver = (idx: number) => {
    setDragOverIdx(idx);
  };
  const onDrop = (dropIdx: number) => {
    if (draggingIdx === null || draggingIdx === dropIdx) {
      setDraggingIdx(null);
      setDragOverIdx(null);
      return;
    }
    setSlots(prev => {
      const next = [...prev];
      const [moved] = next.splice(draggingIdx, 1);
      next.splice(dropIdx, 0, moved!);
      return next;
    });
    setDraggingIdx(null);
    setDragOverIdx(null);
  };
  const onDragEnd = () => {
    setDraggingIdx(null);
    setDragOverIdx(null);
  };

  const onHover = (idx: number | null, x: number, y: number) => {
    if (idx === null) {
      setPopup(null);
    } else {
      const slot = slots[idx];
      if (slot) setPopup({ slot, x, y });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    await importFromFile(
      file,
      (newSlots) => setSlots(prev => [...prev, ...newSlots].slice(0, slotLimit === Infinity ? 9999 : slotLimit)),
      (msg) => setImportError(msg),
    );
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Close popup on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopup(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Harmony Timeline</h2>
          <p className="text-gray-400 text-sm">
            Build a chord-by-chord symmetry narrative — drag to reorder, hover for details
          </p>
        </div>
        <div className="flex-1" />

        {/* Tier badge */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>
            {slots.length}/{slotLimit === Infinity ? '∞' : slotLimit} slots
          </span>
          <span
            className={`px-2 py-0.5 rounded font-medium ${
              isResearch
                ? 'bg-purple-900/60 text-purple-300'
                : isPro
                ? 'bg-indigo-900/60 text-indigo-300'
                : 'bg-gray-700 text-gray-400'
            }`}
          >
            {tier}
          </span>
        </div>

        {/* Import */}
        {isPro ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white text-sm rounded font-medium transition-colors"
            >
              &#x2913; Import from file
            </button>
          </>
        ) : (
          <button
            disabled
            title="Pro required for file import"
            className="px-4 py-2 bg-gray-700 text-gray-500 text-sm rounded font-medium cursor-not-allowed"
          >
            &#x2913; Import (Pro)
          </button>
        )}

        {/* SVG export */}
        {isResearch ? (
          <button
            onClick={() => exportSvg(slots)}
            disabled={slots.length === 0}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded font-medium transition-colors"
          >
            &#x2907; Export SVG
          </button>
        ) : (
          <button
            disabled
            title="Research tier required"
            className="px-4 py-2 bg-gray-700 text-gray-500 text-sm rounded font-medium cursor-not-allowed"
          >
            &#x2907; Export SVG (Research)
          </button>
        )}

        {/* CSV export */}
        {isResearch ? (
          <button
            onClick={() => exportCsv(slots)}
            disabled={slots.length === 0}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded font-medium transition-colors"
          >
            &#x2913; Export CSV
          </button>
        ) : (
          <button
            disabled
            title="Research tier required"
            className="px-4 py-2 bg-gray-700 text-gray-500 text-sm rounded font-medium cursor-not-allowed"
          >
            &#x2913; Export CSV (Research)
          </button>
        )}

        {/* Clear */}
        {slots.length > 0 && (
          <button
            onClick={() => { setSlots([]); setPopup(null); }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded font-medium transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {importError && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
          {importError}
        </div>
      )}

      {/* Stats */}
      {slots.length > 0 && <StatsBar slots={slots} />}

      {/* Timeline canvas */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 overflow-x-auto">
        {slots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <rect x="4" y="20" width="16" height="24" rx="4" fill="#374151" />
              <rect x="24" y="14" width="16" height="36" rx="4" fill="#374151" />
              <rect x="44" y="26" width="16" height="18" rx="4" fill="#374151" />
            </svg>
            <p className="text-sm">No chords yet. Click &ldquo;Add Chord&rdquo; to begin your symmetry narrative.</p>
          </div>
        ) : (
          <SvgTimeline
            slots={slots}
            draggingIdx={draggingIdx}
            dragOverIdx={dragOverIdx}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            onHover={onHover}
          />
        )}
      </div>

      {/* Add Chord button below timeline */}
      <div className="flex justify-center">
        {!atLimit ? (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg font-semibold transition-colors shadow-lg"
          >
            + Add Chord
          </button>
        ) : (
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">
              {isResearch ? 'Limit reached.' : `${tier === 'free' ? 'Free' : 'Pro'} limit: ${slotLimit} slots`}
            </p>
            {!isResearch && (
              <a href="#dashboard" className="text-xs text-indigo-400 hover:underline">
                Upgrade for more
              </a>
            )}
          </div>
        )}
      </div>

      {/* Slot list (removable) */}
      {slots.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Slot List</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {slots.map((slot, idx) => (
              <div
                key={slot.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
              >
                <span className="text-gray-400 text-xs w-5 text-right font-mono">{idx + 1}</span>
                <span
                  className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: groupColor(slot.group) }}
                />
                <span className="text-white text-sm font-medium flex-1 min-w-0 truncate">
                  {slot.chordName ?? `{${slot.pcs.join(',')}}`}
                </span>
                <span className="text-xs font-mono text-gray-400 hidden sm:block">
                  {slot.pcs.map(p => NOTE_NAMES[p]).join(' ')}
                </span>
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: groupColor(slot.group) + '33', color: groupColor(slot.group) }}
                >
                  {slot.group}
                </span>
                <button
                  onClick={() => removeSlot(slot.id)}
                  className="text-gray-500 hover:text-red-400 text-xs transition-colors ml-1"
                >
                  &#x2715;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group legend */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Group Legend</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(GROUP_COLORS).map(([group, color]) => (
            <span
              key={group}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: color + 'cc' }}
            >
              {group}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Groups range from C1 (no symmetry) through D12 (maximal 12-fold symmetry).
          Connected bars show consecutive slots sharing the same group.
        </p>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddChordModal
          onAdd={handleAddSlot}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {popup && (
        <SlotPopup
          slot={popup.slot}
          x={popup.x}
          y={popup.y}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}

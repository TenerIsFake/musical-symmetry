import { useState, useCallback, useRef } from 'react';
import { NOTE_NAMES, generalizedVoiceLeading, applyP, applyL, applyR, CHORD_TEMPLATES, identifyChord } from '@musical-symmetry/core';
import type { PitchClass, Chord } from '@musical-symmetry/core';
import { useUser } from '../context/UserContext';
import { playChordProgression } from '../utils/audio';
import { downloadMidi } from '../utils/midi-writer';
import ProgressionTemplates from '../components/ProgressionTemplates';

// ---- Types ----

interface ProgressionChord {
  id: string;
  pcs: PitchClass[];
  name: string;
}

// ---- Helpers ----

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function totalVoiceLeadingScore(chords: ProgressionChord[]): number {
  let total = 0;
  for (let i = 0; i + 1 < chords.length; i++) {
    total += generalizedVoiceLeading(chords[i]!.pcs, chords[i + 1]!.pcs);
  }
  return total;
}

// Permute inner chords (keep first/last fixed) to minimise VL distance.
function optimizeProgression(chords: ProgressionChord[]): ProgressionChord[] {
  if (chords.length <= 3) return chords;
  const first = chords[0]!;
  const last = chords[chords.length - 1]!;
  const inner = chords.slice(1, -1);

  function permute(arr: ProgressionChord[]): ProgressionChord[][] {
    if (arr.length <= 1) return [arr];
    const result: ProgressionChord[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const perm of permute(rest)) {
        result.push([arr[i]!, ...perm]);
      }
    }
    return result;
  }

  let bestPerm = inner;
  let bestScore = totalVoiceLeadingScore([first, ...inner, last]);

  for (const perm of permute(inner)) {
    const score = totalVoiceLeadingScore([first, ...perm, last]);
    if (score < bestScore) {
      bestScore = score;
      bestPerm = perm;
    }
  }

  return [first, ...bestPerm, last];
}

// Build a chord name from pitchClasses
function nameForPcs(pcs: PitchClass[]): string {
  const chord = identifyChord(pcs);
  if (chord) {
    const qualityLabel: Record<string, string> = {
      major: '',
      minor: 'm',
      diminished: 'dim',
      augmented: 'aug',
    };
    return `${NOTE_NAMES[chord.root]}${qualityLabel[chord.quality] ?? chord.quality}`;
  }
  return `{${pcs.join(',')}}`;
}

// Common chord palette organized by key
const PALETTE_CHORDS: { name: string; pcs: PitchClass[] }[] = (() => {
  const unique = new Map<string, { name: string; pcs: PitchClass[] }>();
  for (const t of CHORD_TEMPLATES) {
    const key = t.pitchClasses.join(',');
    if (!unique.has(key)) {
      unique.set(key, { name: t.name, pcs: t.pitchClasses });
    }
  }
  // Keep only the most-common chord types in C for the palette
  const wantTypes = ['', 'm', 'maj7', 'dom7', 'min7', 'dim', 'aug', 'sus2', 'sus4'];
  const result: { name: string; pcs: PitchClass[] }[] = [];
  for (const t of CHORD_TEMPLATES) {
    const suffix = t.name.slice(t.name.match(/^[A-Z][♯♭]?/)?.[0]?.length ?? 1);
    if (wantTypes.includes(suffix) && t.root !== undefined) {
      result.push({ name: t.name, pcs: t.pitchClasses });
    }
    if (result.length >= 60) break;
  }
  return result;
})();

// ---- Chord Palette Modal ----

interface PaletteProps {
  onSelect: (chord: { name: string; pcs: PitchClass[] }) => void;
  onClose: () => void;
}

function ChordPalette({ onSelect, onClose }: PaletteProps) {
  const [filter, setFilter] = useState('');
  const filtered = PALETTE_CHORDS.filter(c =>
    c.name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-xl p-5 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">Choose a Chord</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&#x2715;</button>
        </div>
        <input
          autoFocus
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter chords…"
          className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-400 mb-4 outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="grid grid-cols-3 gap-2">
          {filtered.map((c, i) => (
            <button
              key={i}
              onClick={() => onSelect(c)}
              className="bg-gray-700 hover:bg-indigo-700 text-white text-sm rounded px-2 py-2 transition-colors text-left truncate"
            >
              {c.name}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-3 text-gray-400 text-sm text-center py-4">No chords match.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- PLR Suggestions Panel ----

interface PlrProps {
  pcs: PitchClass[];
  onSelect: (pcs: PitchClass[], name: string) => void;
}

function PlrSuggestions({ pcs, onSelect }: PlrProps) {
  const chord: Chord | null = identifyChord(pcs);
  if (!chord || (chord.quality !== 'major' && chord.quality !== 'minor')) {
    return <p className="text-gray-500 text-xs italic">PLR requires major/minor triad</p>;
  }

  const transforms = [
    { label: 'P', result: applyP(chord) },
    { label: 'L', result: applyL(chord) },
    { label: 'R', result: applyR(chord) },
  ];

  return (
    <div className="space-y-1">
      {transforms.map(({ label, result }) => {
        const name = nameForPcs(result.pitchClasses);
        return (
          <button
            key={label}
            onClick={() => onSelect(result.pitchClasses, name)}
            className="w-full flex items-center gap-2 px-2 py-1 rounded bg-gray-700 hover:bg-indigo-700 text-xs text-left transition-colors"
          >
            <span className="font-mono font-bold text-indigo-400 w-4">{label}</span>
            <span className="text-white">{name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---- Genre DNA Panel ----

interface GenreDnaProps {
  chords: ProgressionChord[];
  tier: 'free' | 'pro' | 'research' | null;
}

interface GenreMatch {
  genre: string;
  confidence: number;
  characteristics: string[];
  explanation: string;
}

function GenreDnaPanel({ chords, tier }: GenreDnaProps) {
  const [matches, setMatches] = useState<GenreMatch[] | null>(null);
  const [suggestions, setSuggestions] = useState<{ pcs: number[]; name: string; reason: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detect = useCallback(async () => {
    if (chords.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      // Build a simple interval vector average from all chords
      // We'll just pass forte numbers approximated from pcs count
      const forteNumbers: string[] = chords.map(c => `${c.pcs.length}-1`);
      // Use a flat interval vector for now — the backend will score it
      const avgIv: number[] = [2, 2, 3, 3, 3, 1];

      const res = await fetch('/api/genre/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ forteNumbers, intervalVector: avgIv }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setMatches(tier === 'free' ? data.matches?.slice(0, 1) : data.matches);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to detect genre');
    } finally {
      setLoading(false);
    }
  }, [chords, tier]);

  const suggest = useCallback(async (genre?: string) => {
    if (chords.length < 1) return;
    setLoading(true);
    setError(null);
    try {
      const progression = chords.map(c => c.pcs);
      const res = await fetch('/api/genre/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ progression, genre }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSuggestions(data.suggestions);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get suggestions');
    } finally {
      setLoading(false);
    }
  }, [chords]);

  return (
    <div className="bg-gray-800 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Genre DNA</h3>
        {tier === 'free' && (
          <span className="text-xs text-yellow-400 bg-yellow-900/40 px-2 py-0.5 rounded">Free: top match only</span>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        <button
          onClick={detect}
          disabled={loading || chords.length < 2}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs rounded font-medium transition-colors"
        >
          {loading ? 'Analyzing…' : 'Detect Genre'}
        </button>
        {(tier === 'pro' || tier === 'research') && (
          <button
            onClick={() => suggest(matches?.[0]?.genre)}
            disabled={loading || chords.length < 1}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs rounded font-medium transition-colors"
          >
            Suggest Next
          </button>
        )}
        {tier === 'free' && (
          <button
            disabled
            title="Pro required"
            className="px-3 py-1.5 bg-gray-700 text-gray-500 text-xs rounded font-medium cursor-not-allowed"
          >
            Suggest Next (Pro)
          </button>
        )}
      </div>

      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

      {matches && (
        <div className="space-y-2 mb-3">
          {matches.map((m, i) => (
            <div key={i} className="bg-gray-700/60 rounded p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white text-sm font-medium">{m.genre}</span>
                <span className="text-xs text-indigo-300">{Math.round(m.confidence * 100)}%</span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-1.5 mb-1">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full"
                  style={{ width: `${Math.round(m.confidence * 100)}%` }}
                />
              </div>
              <p className="text-gray-400 text-xs">{m.explanation}</p>
            </div>
          ))}
        </div>
      )}

      {suggestions && (
        <div>
          <p className="text-xs text-gray-400 mb-2 font-medium">Suggested next chords:</p>
          <div className="space-y-1">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-700/50 rounded px-2 py-1">
                <span className="text-white text-sm font-medium">{s.name}</span>
                <span className="text-gray-400 text-xs flex-1">{s.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main Page ----

const FREE_CHORD_LIMIT = 4;

export default function ProgressionPage() {
  const { user } = useUser();
  const tier = user?.tier ?? 'free';
  const isPro = tier === 'pro' || tier === 'research';
  const isResearch = tier === 'research';

  const [chords, setChords] = useState<ProgressionChord[]>([]);
  const [showPalette, setShowPalette] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateSessionLoads, setTemplateSessionLoads] = useState(0);
  const [insertAfterIdx, setInsertAfterIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(100);
  const dragHandled = useRef(false);

  const atLimit = !isPro && chords.length >= FREE_CHORD_LIMIT;

  const openPalette = (afterIdx: number | null = null) => {
    setInsertAfterIdx(afterIdx);
    setShowPalette(true);
  };

  const handlePaletteSelect = useCallback(
    (chord: { name: string; pcs: PitchClass[] }) => {
      const newChord: ProgressionChord = { id: uid(), pcs: chord.pcs, name: chord.name };
      setChords(prev => {
        if (insertAfterIdx === null) return [...prev, newChord];
        const next = [...prev];
        next.splice(insertAfterIdx + 1, 0, newChord);
        return next;
      });
      setShowPalette(false);
    },
    [insertAfterIdx],
  );

  const removeChord = (id: string) => {
    setChords(prev => prev.filter(c => c.id !== id));
    setSelectedIdx(null);
  };

  const handleOptimize = () => {
    if (!isPro) return;
    setChords(prev => optimizeProgression(prev));
  };

  const handlePlay = async () => {
    if (chords.length === 0) return;
    setIsPlaying(true);
    playChordProgression(chords.map(c => c.pcs), bpm);
    const durationMs = (chords.length * (60 / bpm) + 0.5) * 1000;
    setTimeout(() => setIsPlaying(false), durationMs);
  };

  const handleExportMidi = () => {
    if (!isResearch) return;
    downloadMidi(chords.map(c => c.pcs), bpm);
  };

  const handlePlrInsert = (pcs: PitchClass[], name: string) => {
    const newChord: ProgressionChord = { id: uid(), pcs, name };
    setChords(prev => [...prev, newChord]);
  };

  const handleTemplateLoad = useCallback(
    (incoming: { pcs: number[]; name: string }[]) => {
      const newChords: ProgressionChord[] = incoming.map(c => ({
        id: uid(),
        pcs: c.pcs as PitchClass[],
        name: c.name,
      }));
      if (isPro) {
        // Pro: replace current progression entirely
        setChords(newChords);
      } else {
        // Free: append (up to FREE_CHORD_LIMIT)
        setChords(prev => {
          const combined = [...prev, ...newChords];
          return combined.slice(0, FREE_CHORD_LIMIT);
        });
      }
      setSelectedIdx(null);
    },
    [isPro],
  );

  // Drag-and-drop
  const onDragStart = (idx: number) => {
    setDraggingIdx(idx);
    dragHandled.current = false;
  };
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const onDrop = (dropIdx: number) => {
    if (draggingIdx === null || draggingIdx === dropIdx) {
      setDraggingIdx(null);
      setDragOverIdx(null);
      return;
    }
    setChords(prev => {
      const next = [...prev];
      const [moved] = next.splice(draggingIdx, 1);
      next.splice(dropIdx, 0, moved!);
      return next;
    });
    setDraggingIdx(null);
    setDragOverIdx(null);
    dragHandled.current = true;
  };
  const onDragEnd = () => {
    setDraggingIdx(null);
    setDragOverIdx(null);
  };

  const vlScore = totalVoiceLeadingScore(chords);
  const selectedChord = selectedIdx !== null ? chords[selectedIdx] ?? null : null;

  return (
    <div className="space-y-6">
      {/* Header + controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Progression Builder</h2>
          <p className="text-gray-400 text-sm">Build and optimize chord progressions with voice-leading analysis</p>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">BPM</label>
          <input
            type="number"
            value={bpm}
            min={40}
            max={240}
            onChange={e => setBpm(Math.max(40, Math.min(240, parseInt(e.target.value) || 100)))}
            className="w-16 bg-gray-700 rounded px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={() => setShowTemplates(true)}
          className="px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white text-sm rounded font-medium transition-colors"
        >
          &#x2605; Templates
        </button>
        <button
          onClick={handlePlay}
          disabled={chords.length === 0 || isPlaying}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded font-medium transition-colors"
        >
          {isPlaying ? '&#9654; Playing…' : '&#9654; Play'}
        </button>
        <button
          onClick={handleOptimize}
          disabled={!isPro || chords.length <= 3}
          title={!isPro ? 'Requires Pro tier' : 'Try all orderings to minimise voice-leading distance'}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded font-medium transition-colors"
        >
          &#x2728; Optimize {!isPro && <span className="text-xs opacity-70">(Pro)</span>}
        </button>
        {isResearch && (
          <button
            onClick={handleExportMidi}
            disabled={chords.length === 0}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded font-medium transition-colors"
          >
            &#x2913; MIDI
          </button>
        )}
        {!isResearch && (
          <button
            disabled
            title="MIDI export requires Research tier"
            className="px-4 py-2 bg-gray-700 text-gray-500 text-sm rounded font-medium cursor-not-allowed"
          >
            &#x2913; MIDI (Research)
          </button>
        )}
      </div>

      {/* Timeline canvas */}
      <div className="bg-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Timeline</span>
          {chords.length > 0 && (
            <span className="text-xs text-gray-400">
              VL Score: <span className="text-indigo-300 font-mono font-bold">{vlScore}</span>
              <span className="ml-1 text-gray-500">(lower = smoother)</span>
            </span>
          )}
        </div>

        <div className="flex items-stretch gap-2 overflow-x-auto pb-2 min-h-[100px]">
          {chords.map((chord, idx) => (
            <div
              key={chord.id}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={e => onDragOver(e, idx)}
              onDrop={() => onDrop(idx)}
              onDragEnd={onDragEnd}
              onClick={() => setSelectedIdx(idx === selectedIdx ? null : idx)}
              className={[
                'flex-shrink-0 w-28 rounded-lg p-3 cursor-pointer select-none transition-all border-2',
                selectedIdx === idx
                  ? 'border-indigo-500 bg-indigo-900/40'
                  : 'border-gray-600 bg-gray-700 hover:border-gray-400',
                draggingIdx === idx ? 'opacity-40' : '',
                dragOverIdx === idx && draggingIdx !== idx ? 'border-yellow-400' : '',
              ].join(' ')}
            >
              <div className="text-xs text-gray-400 mb-1 font-mono">#{idx + 1}</div>
              <div className="text-white font-semibold text-sm leading-tight mb-2 truncate">{chord.name}</div>
              <div className="text-gray-400 text-xs font-mono">
                {chord.pcs.map(pc => NOTE_NAMES[pc]).join(' ')}
              </div>
              {idx > 0 && (
                <div className="mt-2 text-xs text-indigo-300 font-mono">
                  VL: {generalizedVoiceLeading(chords[idx - 1]!.pcs, chord.pcs)}
                </div>
              )}
              <button
                onClick={e => { e.stopPropagation(); removeChord(chord.id); }}
                className="mt-2 text-gray-500 hover:text-red-400 text-xs transition-colors"
              >
                Remove
              </button>
            </div>
          ))}

          {/* Add chord button */}
          {!atLimit ? (
            <button
              onClick={() => openPalette(chords.length > 0 ? chords.length - 1 : null)}
              className="flex-shrink-0 w-28 rounded-lg border-2 border-dashed border-gray-600 hover:border-indigo-500 bg-gray-700/30 hover:bg-gray-700/50 flex flex-col items-center justify-center gap-1 transition-colors min-h-[100px] text-gray-400 hover:text-indigo-400"
            >
              <span className="text-3xl leading-none">+</span>
              <span className="text-xs">Add Chord</span>
            </button>
          ) : (
            <div className="flex-shrink-0 w-28 rounded-lg border-2 border-dashed border-gray-700 flex flex-col items-center justify-center gap-1 min-h-[100px] text-gray-600">
              <span className="text-xs text-center px-2">Free limit: {FREE_CHORD_LIMIT} chords</span>
              <a href="#dashboard" className="text-xs text-indigo-400 hover:underline">Upgrade</a>
            </div>
          )}

          {chords.length === 0 && (
            <p className="text-gray-500 text-sm self-center pl-2 italic">
              Click &ldquo;+ Add Chord&rdquo; to begin building your progression.
            </p>
          )}
        </div>
      </div>

      {/* Detail panel for selected chord */}
      {selectedChord && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
            Selected: <span className="text-white normal-case font-bold">{selectedChord.name}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium">PLR Transforms &mdash; click to append</p>
              <PlrSuggestions pcs={selectedChord.pcs} onSelect={handlePlrInsert} />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium">Pitch Classes</p>
              <div className="flex flex-wrap gap-1">
                {selectedChord.pcs.map((pc, i) => (
                  <span key={i} className="bg-indigo-900/60 text-indigo-300 text-xs px-2 py-0.5 rounded font-mono">
                    {NOTE_NAMES[pc]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Genre DNA */}
      {chords.length >= 2 && (
        <GenreDnaPanel chords={chords} tier={tier} />
      )}

      {/* Chord palette modal */}
      {showPalette && (
        <ChordPalette
          onSelect={handlePaletteSelect}
          onClose={() => setShowPalette(false)}
        />
      )}

      {/* Progression templates modal */}
      {showTemplates && (
        <ProgressionTemplates
          onLoad={handleTemplateLoad}
          onClose={() => setShowTemplates(false)}
          sessionLoads={templateSessionLoads}
          onSessionLoad={() => setTemplateSessionLoads(prev => prev + 1)}
        />
      )}
    </div>
  );
}

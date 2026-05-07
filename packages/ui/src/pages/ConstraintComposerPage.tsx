import { useState, useCallback } from 'react';
import { NOTE_NAMES, generateCandidates } from '@musical-symmetry/core';
import type { PitchClass, CompositionCandidate, CompositionConstraints } from '@musical-symmetry/core';
import { useUser } from '../context/UserContext';

// ---------- MIDI utilities ----------

function midiToName(midi: number): string {
  const pc = (midi % 12) as PitchClass;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ---------- Audio playback ----------

function playMelody(notes: { midi: number }[]): void {
  const ctx = new AudioContext();
  const noteDuration = 0.35;
  notes.forEach(({ midi }, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = midiToFreq(midi);
    gain.gain.value = 0.35;
    osc.connect(gain).connect(ctx.destination);
    const start = ctx.currentTime + i * noteDuration;
    osc.start(start);
    gain.gain.setValueAtTime(0.35, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration * 0.85);
    osc.stop(start + noteDuration);
  });
}

// ---------- Interactive piano keyboard ----------

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

// ---------- Mini piano roll ----------

function MiniPianoRoll({ notes }: { notes: { midi: number }[] }) {
  if (notes.length === 0) return null;
  const midis = notes.map(n => n.midi);
  const minMidi = Math.min(...midis);
  const maxMidi = Math.max(...midis);
  const range = Math.max(maxMidi - minMidi, 1);
  const width = 200;
  const height = 48;
  const colWidth = width / notes.length;

  return (
    <svg width={width} height={height} className="bg-gray-900 rounded border border-gray-700">
      {notes.map(({ midi }, i) => {
        const x = i * colWidth;
        const y = height - ((midi - minMidi) / range) * (height - 6) - 6;
        return (
          <g key={i}>
            <rect
              x={x + 1}
              y={y}
              width={colWidth - 2}
              height={6}
              rx={1}
              className="fill-indigo-500"
            />
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Candidate card ----------

function CandidateCard({ candidate, index }: { candidate: CompositionCandidate; index: number }) {
  const noteNames = candidate.notes.map(n => midiToName(n.midi)).join(' · ');
  const csegStr = `[${candidate.contour.join(', ')}]`;

  function handleAudition() {
    playMelody(candidate.notes);
  }

  function handleSendToSketch() {
    const data = {
      notes: candidate.notes.map((n, i) => ({
        midi: n.midi,
        time: i * 0.5,
        duration: 0.4,
      })),
    };
    sessionStorage.setItem('sketchpad-import', JSON.stringify(data));
    window.location.hash = 'sketchpad';
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col gap-3 hover:border-indigo-500 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-mono">#{index + 1}</span>
        <span className="text-xs text-indigo-400 font-mono">CSEG {csegStr}</span>
      </div>
      <p className="text-sm text-gray-200 font-mono leading-relaxed break-all">{noteNames}</p>
      <MiniPianoRoll notes={candidate.notes} />
      <div className="flex gap-2 mt-1">
        <button
          onClick={handleAudition}
          className="flex-1 px-3 py-1.5 rounded text-xs font-medium bg-indigo-700 hover:bg-indigo-600 text-white transition-colors"
        >
          ▶ Audition
        </button>
        <button
          onClick={handleSendToSketch}
          className="flex-1 px-3 py-1.5 rounded text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
        >
          Send to Sketch
        </button>
      </div>
    </div>
  );
}

// ---------- Main page ----------

export default function ConstraintComposerPage() {
  const { user } = useUser();
  const tier = user?.tier ?? 'free';

  const maxLength = tier === 'research' ? 64 : tier === 'pro' ? 32 : 8;
  const canUseContour = tier !== 'free';
  const canUseRegister = tier !== 'free';

  const [selectedPcs, setSelectedPcs] = useState<Set<PitchClass>>(new Set([0, 4, 7] as PitchClass[]));
  const [length, setLength] = useState(8);
  const [registerLow, setRegisterLow] = useState(60);
  const [registerHigh, setRegisterHigh] = useState(84);
  const [avoidRepeats, setAvoidRepeats] = useState(true);
  const [useMaxLeap, setUseMaxLeap] = useState(false);
  const [maxLeap, setMaxLeap] = useState(7);
  const [contourInput, setContourInput] = useState('');
  const [candidates, setCandidates] = useState<CompositionCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const togglePc = useCallback((pc: PitchClass) => {
    setSelectedPcs(prev => {
      const next = new Set(prev);
      if (next.has(pc)) next.delete(pc);
      else next.add(pc);
      return next;
    });
  }, []);

  function parseContour(input: string): number[] | undefined {
    const trimmed = input.trim();
    if (!trimmed) return undefined;
    const parts = trimmed.split(/[\s,]+/).map(s => parseInt(s, 10));
    if (parts.some(isNaN)) return undefined;
    return parts;
  }

  function handleGenerate() {
    setError(null);
    const pitchClassSet = [...selectedPcs] as PitchClass[];
    if (pitchClassSet.length === 0) {
      setError('Select at least one pitch class.');
      return;
    }

    const parsedContour = canUseContour ? parseContour(contourInput) : undefined;
    if (canUseContour && contourInput.trim() && parsedContour === undefined) {
      setError('Invalid contour — use comma- or space-separated integers like "0,2,1,3".');
      return;
    }
    if (parsedContour !== undefined && parsedContour.length !== length) {
      setError(`Contour length (${parsedContour.length}) must match melody length (${length}).`);
      return;
    }

    const constraints: CompositionConstraints = {
      pitchClassSet,
      length: Math.min(length, maxLength),
      contourClass: parsedContour,
      registerLow: canUseRegister ? registerLow : undefined,
      registerHigh: canUseRegister ? registerHigh : undefined,
      avoidRepeats,
      maxLeap: useMaxLeap ? maxLeap : undefined,
    };

    setIsGenerating(true);
    // Use setTimeout to let UI update before potentially heavy computation
    setTimeout(() => {
      try {
        const results = generateCandidates(constraints, 10);
        setCandidates(results);
        if (results.length === 0) {
          setError('No candidates found with these constraints. Try relaxing the constraints.');
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setIsGenerating(false);
      }
    }, 10);
  }

  return (
    <div className="space-y-6">
      {/* Input section */}
      <section className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-5">
        <h2 className="text-lg font-semibold text-white">Constraints</h2>

        {/* Pitch class selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Allowed Pitch Classes ({selectedPcs.size} selected)
          </label>
          <PianoKeyboard selected={selectedPcs} onToggle={togglePc} />
          <div className="mt-2 flex gap-1 flex-wrap">
            {([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as PitchClass[]).map(pc => (
              <span
                key={pc}
                className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                  selectedPcs.has(pc) ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-500'
                }`}
              >
                {NOTE_NAMES[pc]}
              </span>
            ))}
          </div>
        </div>

        {/* Length */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Length: <span className="text-indigo-400 font-mono">{length}</span> notes
            {tier === 'free' && <span className="text-xs text-gray-500 ml-2">(Free: max 8 — upgrade for more)</span>}
          </label>
          <input
            type="range"
            min={4}
            max={maxLength}
            value={length}
            onChange={e => setLength(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-0.5">
            <span>4</span>
            <span>{maxLength}</span>
          </div>
        </div>

        {/* Register */}
        {canUseRegister ? (
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Register Low (MIDI)</label>
              <input
                type="number"
                min={21}
                max={registerHigh - 1}
                value={registerLow}
                onChange={e => setRegisterLow(Number(e.target.value))}
                className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
              />
              <span className="text-xs text-gray-500 ml-1">{midiToName(registerLow)}</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Register High (MIDI)</label>
              <input
                type="number"
                min={registerLow + 1}
                max={108}
                value={registerHigh}
                onChange={e => setRegisterHigh(Number(e.target.value))}
                className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
              />
              <span className="text-xs text-gray-500 ml-1">{midiToName(registerHigh)}</span>
            </div>
          </div>
        ) : (
          <div className="bg-gray-750 border border-gray-600 rounded-lg p-3 text-sm text-gray-400">
            Register control requires <span className="text-amber-400 font-medium">Pro</span> tier.
          </div>
        )}

        {/* Avoid repeats + Max leap */}
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={avoidRepeats}
              onChange={e => setAvoidRepeats(e.target.checked)}
              className="accent-indigo-500 w-4 h-4"
            />
            <span className="text-sm text-gray-300">Avoid repeated consecutive pitches</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useMaxLeap}
              onChange={e => setUseMaxLeap(e.target.checked)}
              className="accent-indigo-500 w-4 h-4"
            />
            <span className="text-sm text-gray-300">
              Max leap: <span className="text-indigo-400 font-mono">{maxLeap}</span> semitones
            </span>
          </label>
          {useMaxLeap && (
            <div className="ml-6">
              <input
                type="range"
                min={1}
                max={12}
                value={maxLeap}
                onChange={e => setMaxLeap(Number(e.target.value))}
                className="w-48 accent-indigo-500"
              />
              <div className="flex justify-between text-xs text-gray-500 w-48">
                <span>1</span>
                <span>12</span>
              </div>
            </div>
          )}
        </div>

        {/* Contour input */}
        {canUseContour ? (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Target Contour (CSEG) — optional
            </label>
            <input
              type="text"
              placeholder={`e.g. 0,2,1,3 — must be ${length} integers starting from 0`}
              value={contourInput}
              onChange={e => setContourInput(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter space- or comma-separated rank integers. Length must match melody length ({length}).
            </p>
          </div>
        ) : (
          <div className="bg-gray-750 border border-gray-600 rounded-lg p-3 text-sm text-gray-400">
            Contour constraints require <span className="text-amber-400 font-medium">Pro</span> tier.
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || selectedPcs.size === 0}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
        >
          {isGenerating ? 'Generating…' : 'Generate Candidates'}
        </button>
      </section>

      {/* Results section */}
      {candidates.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">
            Results <span className="text-gray-500 font-normal text-sm">({candidates.length} candidates)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {candidates.map((candidate, i) => (
              <CandidateCard key={i} candidate={candidate} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {candidates.length === 0 && !isGenerating && !error && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">♩</p>
          <p className="text-sm">Select pitch classes and click Generate to create melody candidates.</p>
        </div>
      )}
    </div>
  );
}

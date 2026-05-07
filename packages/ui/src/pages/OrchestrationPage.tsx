import { useState, useCallback } from 'react';
import { NOTE_NAMES } from '@musical-symmetry/core';
import { suggestOrchestrations } from '@musical-symmetry/core';
import type { PitchClass, OrchestrationSuggestion, VoicingAssignment } from '@musical-symmetry/core';
import { INSTRUMENTS } from '../data/instrument-ranges';
import type { Instrument } from '../data/instrument-ranges';
import { useUser } from '../context/UserContext';

// ─── MIDI / audio utilities ───────────────────────────────────────────────────

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function midiToName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12 as PitchClass;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}

type OscType = 'sine' | 'triangle' | 'square' | 'sawtooth';

function familyToOscType(family: string): OscType {
  if (family === 'string') return 'sine';
  if (family === 'woodwind') return 'triangle';
  if (family === 'brass') return 'square';
  if (family === 'keyboard') return 'sine';
  if (family === 'percussion') return 'triangle';
  return 'sine';
}

function playVoicing(voicing: VoicingAssignment[], instrumentList: Instrument[]): void {
  const ctx = new AudioContext();
  const duration = 2.0;

  voicing.forEach(({ instrument, midiNote }) => {
    const instr = instrumentList.find(i => i.name === instrument);
    const oscType: OscType = instr ? familyToOscType(instr.family) : 'sine';

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = oscType;
    osc.frequency.value = midiToFreq(midiNote);
    gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
    gain.gain.setValueAtTime(0.25, now + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.start(now);
    osc.stop(now + duration);
  });
}

// ─── Piano keyboard component ─────────────────────────────────────────────────

const WHITE_KEYS: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];
const BLACK_KEYS: PitchClass[] = [1, 3, 6, 8, 10];
const BLACK_POSITIONS: Record<number, number> = { 1: 0.6, 3: 1.6, 6: 3.6, 8: 4.6, 10: 5.6 };

function PianoKeyboard({
  selected,
  onToggle,
}: {
  selected: Set<PitchClass>;
  onToggle: (pc: PitchClass) => void;
}) {
  return (
    <div className="relative flex" style={{ height: '5rem' }}>
      {WHITE_KEYS.map(pc => (
        <button
          key={pc}
          onClick={() => onToggle(pc)}
          title={NOTE_NAMES[pc]}
          className={`relative w-8 h-20 border border-gray-600 rounded-b flex items-end justify-center pb-1 text-xs font-bold select-none transition-colors ${
            selected.has(pc)
              ? 'bg-indigo-400 text-white border-indigo-500'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {NOTE_NAMES[pc]}
        </button>
      ))}
      {BLACK_KEYS.map(pc => {
        const pos = BLACK_POSITIONS[pc]!;
        return (
          <button
            key={pc}
            onClick={() => onToggle(pc)}
            title={NOTE_NAMES[pc]}
            style={{ position: 'absolute', left: `${pos * 32}px`, top: 0, zIndex: 10 }}
            className={`w-6 h-14 rounded-b flex items-end justify-center pb-1 text-xs font-bold select-none transition-colors ${
              selected.has(pc)
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {selected.has(pc) ? NOTE_NAMES[pc] : ''}
          </button>
        );
      })}
    </div>
  );
}

// ─── Voicing diagram ──────────────────────────────────────────────────────────

function VoicingDiagram({ voicing }: { voicing: VoicingAssignment[] }) {
  if (voicing.length === 0) return null;

  const sorted = [...voicing].sort((a, b) => b.midiNote - a.midiNote);
  const midis = sorted.map(v => v.midiNote);
  const minMidi = Math.min(...midis);
  const maxMidi = Math.max(...midis);
  const range = Math.max(maxMidi - minMidi, 1);

  const BAR_HEIGHT = 20;
  const LABEL_WIDTH = 110;
  const NOTE_WIDTH = 60;
  const HEIGHT = sorted.length * (BAR_HEIGHT + 6) + 8;

  return (
    <svg
      width={LABEL_WIDTH + NOTE_WIDTH + 40}
      height={HEIGHT}
      className="bg-gray-900 rounded border border-gray-700"
    >
      {sorted.map((v, i) => {
        const y = 4 + i * (BAR_HEIGHT + 6);
        const noteX = LABEL_WIDTH + 8;
        const barWidth = 4 + Math.round(((v.midiNote - minMidi) / range) * (NOTE_WIDTH - 8));

        return (
          <g key={i}>
            <text
              x={LABEL_WIDTH - 4}
              y={y + BAR_HEIGHT / 2 + 4}
              textAnchor="end"
              className="fill-gray-400"
              fontSize={9}
              fontFamily="monospace"
            >
              {v.instrument}
            </text>
            <rect
              x={noteX}
              y={y}
              width={Math.max(barWidth, 6)}
              height={BAR_HEIGHT}
              rx={3}
              className="fill-indigo-600"
            />
            <text
              x={noteX + Math.max(barWidth, 6) + 4}
              y={y + BAR_HEIGHT / 2 + 4}
              className="fill-gray-300"
              fontSize={9}
              fontFamily="monospace"
            >
              {midiToName(v.midiNote)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Suggestion card ──────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  instrumentList,
}: {
  suggestion: OrchestrationSuggestion;
  instrumentList: Instrument[];
}) {
  const [playing, setPlaying] = useState(false);

  function handleAudition() {
    if (playing) return;
    setPlaying(true);
    playVoicing(suggestion.voicing, instrumentList);
    setTimeout(() => setPlaying(false), 2200);
  }

  const scoreColor =
    suggestion.score >= 80
      ? 'bg-emerald-700 text-emerald-100'
      : suggestion.score >= 60
      ? 'bg-indigo-700 text-indigo-100'
      : 'bg-gray-600 text-gray-200';

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 flex flex-col gap-4 hover:border-indigo-500 transition-colors">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-base">{suggestion.label}</h3>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${scoreColor}`}>
          {suggestion.score}/100
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {suggestion.instruments.map(name => (
          <span
            key={name}
            className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full"
          >
            {name}
          </span>
        ))}
      </div>

      <VoicingDiagram voicing={suggestion.voicing} />

      <ul className="space-y-1">
        {suggestion.reasoning.map((r, i) => (
          <li key={i} className="text-xs text-gray-400 flex gap-2">
            <span className="text-indigo-500 mt-0.5">&#8226;</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={handleAudition}
        disabled={playing}
        className={`self-start px-4 py-1.5 rounded text-sm font-medium transition-colors ${
          playing
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-indigo-700 text-white hover:bg-indigo-600'
        }`}
      >
        {playing ? 'Playing…' : 'Audition'}
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const ALL_FAMILIES = ['woodwind', 'brass', 'string', 'percussion', 'keyboard'] as const;
type Family = typeof ALL_FAMILIES[number];

const FORTE_PATTERN = /^\d{1,2}-z?\d{1,2}$/i;

export default function OrchestrationPage() {
  const { user, loading } = useUser();

  const [selectedPcs, setSelectedPcs] = useState<Set<PitchClass>>(new Set());
  const [forteInput, setForteInput] = useState('');
  const [forteError, setForteError] = useState('');
  const [registerLow, setRegisterLow] = useState(36);
  const [registerHigh, setRegisterHigh] = useState(96);
  const [families, setFamilies] = useState<Set<Family>>(new Set(ALL_FAMILIES));
  const [suggestions, setSuggestions] = useState<OrchestrationSuggestion[]>([]);
  const [ran, setRan] = useState(false);

  // Tier gate — Pro+ required
  if (!loading && (!user || user.tier === 'free')) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-6">
        <div className="text-5xl">&#127928;</div>
        <h2 className="text-2xl font-bold text-white">Orchestration Suggestions</h2>
        <p className="text-gray-400 leading-relaxed">
          Enter any pitch-class set and receive intelligent voicing suggestions for real orchestral
          instruments — complete with range analysis, spacing reasoning, and audition playback.
        </p>
        <p className="text-gray-500 text-sm">
          This feature requires a <strong className="text-indigo-400">Pro</strong> or higher
          subscription.
        </p>
        <a
          href="https://symmetry.tendrid.us/pricing"
          className="inline-block px-6 py-3 rounded-lg bg-indigo-700 text-white font-semibold hover:bg-indigo-600 transition-colors"
        >
          Upgrade to Pro
        </a>
      </div>
    );
  }

  const togglePc = useCallback((pc: PitchClass) => {
    setSelectedPcs(prev => {
      const next = new Set(prev);
      if (next.has(pc)) {
        next.delete(pc);
      } else {
        next.add(pc);
      }
      return next;
    });
    setSuggestions([]);
    setRan(false);
  }, []);

  const toggleFamily = useCallback((f: Family) => {
    setFamilies(prev => {
      const next = new Set(prev);
      if (next.has(f)) {
        next.delete(f);
      } else {
        next.add(f);
      }
      return next;
    });
  }, []);

  function handleForteImport() {
    const val = forteInput.trim();
    if (!val) return;
    if (!FORTE_PATTERN.test(val)) {
      setForteError('Format: e.g. 3-11 or 4-Z29');
      return;
    }
    setForteError('Format: e.g. 3-11 or 4-Z29 (paste the pitch classes manually for now)');
  }

  function handleSuggest() {
    const pcs = Array.from(selectedPcs) as PitchClass[];
    if (pcs.length < 2) return;

    const availableInstrs = INSTRUMENTS.filter(i =>
      families.has(i.family as Family)
    );

    const results = suggestOrchestrations(pcs, availableInstrs, {
      registerLow,
      registerHigh,
      families: Array.from(families),
      maxResults: 5,
    });

    setSuggestions(results);
    setRan(true);
  }

  const pcsArray = Array.from(selectedPcs).sort((a, b) => a - b);
  const pcNames = pcsArray.map(pc => NOTE_NAMES[pc]).join(', ');

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Pitch class input */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">1. Select Pitch Classes</h2>

        <div className="overflow-x-auto">
          <PianoKeyboard selected={selectedPcs} onToggle={togglePc} />
        </div>

        {pcsArray.length > 0 && (
          <p className="text-sm text-indigo-300 font-mono">
            Selected ({pcsArray.length}): {pcNames}
          </p>
        )}

        {/* Forte number import */}
        <div className="flex gap-2 items-start">
          <input
            type="text"
            placeholder="Forte number e.g. 3-11"
            value={forteInput}
            onChange={e => {
              setForteInput(e.target.value);
              setForteError('');
            }}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-48"
          />
          <button
            onClick={handleForteImport}
            className="px-3 py-1.5 rounded bg-gray-700 text-gray-300 text-sm hover:bg-gray-600 transition-colors"
          >
            Load Forte
          </button>
          <button
            onClick={() => {
              setSelectedPcs(new Set());
              setSuggestions([]);
              setRan(false);
            }}
            className="px-3 py-1.5 rounded bg-gray-700 text-gray-400 text-sm hover:bg-gray-600 transition-colors"
          >
            Clear
          </button>
        </div>
        {forteError && <p className="text-xs text-amber-400">{forteError}</p>}
      </section>

      {/* Register sliders */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">2. Register Range</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-sm text-gray-400">
              Low register: <span className="text-indigo-300 font-mono">{midiToName(registerLow)}</span>
            </label>
            <input
              type="range"
              min={21}
              max={108}
              value={registerLow}
              onChange={e => {
                const v = Number(e.target.value);
                setRegisterLow(Math.min(v, registerHigh - 12));
              }}
              className="w-full accent-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-400">
              High register: <span className="text-indigo-300 font-mono">{midiToName(registerHigh)}</span>
            </label>
            <input
              type="range"
              min={21}
              max={108}
              value={registerHigh}
              onChange={e => {
                const v = Number(e.target.value);
                setRegisterHigh(Math.max(v, registerLow + 12));
              }}
              className="w-full accent-indigo-500"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Range: {midiToName(registerLow)} &ndash; {midiToName(registerHigh)}{' '}
          ({registerHigh - registerLow} semitones)
        </p>
      </section>

      {/* Family filter */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">3. Instrument Families</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_FAMILIES.map(f => (
            <button
              key={f}
              onClick={() => toggleFamily(f)}
              className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-colors ${
                families.has(f)
                  ? 'bg-indigo-700 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </section>

      {/* Suggest button */}
      <section>
        <button
          onClick={handleSuggest}
          disabled={selectedPcs.size < 2}
          className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            selectedPcs.size < 2
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-500'
          }`}
        >
          Suggest Orchestrations
        </button>
        {selectedPcs.size < 2 && (
          <p className="text-xs text-gray-500 mt-2">Select at least 2 pitch classes to continue.</p>
        )}
      </section>

      {/* Results */}
      {ran && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            Results
            {suggestions.length > 0 && (
              <span className="ml-2 text-sm text-gray-400 font-normal">
                {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
              </span>
            )}
          </h2>

          {suggestions.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No suggestions found — try enabling more instrument families or broadening the register
              range.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {suggestions.map((s, i) => (
                <SuggestionCard key={i} suggestion={s} instrumentList={INSTRUMENTS} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

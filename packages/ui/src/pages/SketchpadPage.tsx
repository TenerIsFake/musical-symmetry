import { useState, useRef, useCallback, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useSketchpad, type MelodyNote, type SavedSketch } from '../hooks/useSketchpad';

const STEPS_PER_BEAT = 4;
const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BASE_FREQ = 261.63; // Middle C

const COMMON_CHORDS: { label: string; pcs: number[] }[] = [
  { label: 'C maj', pcs: [0, 4, 7] },
  { label: 'D maj', pcs: [2, 6, 9] },
  { label: 'E maj', pcs: [4, 8, 11] },
  { label: 'F maj', pcs: [5, 9, 0] },
  { label: 'G maj', pcs: [7, 11, 2] },
  { label: 'A maj', pcs: [9, 1, 4] },
  { label: 'C min', pcs: [0, 3, 7] },
  { label: 'D min', pcs: [2, 5, 9] },
  { label: 'E min', pcs: [4, 7, 11] },
  { label: 'A min', pcs: [9, 0, 4] },
  { label: 'G7',   pcs: [7, 11, 2, 5] },
  { label: 'Cdim', pcs: [0, 3, 6] },
];

type Tier = 'free' | 'pro' | 'research';

const SKETCH_LIMITS: Record<Tier, number> = { free: 3, pro: 50, research: Infinity };
const BAR_LIMITS: Record<Tier, number> = { free: 8, pro: 64, research: Infinity };

function getTier(tier: string): Tier {
  if (tier === 'pro' || tier === 'research') return tier;
  return 'free';
}

// ---- Audio engine ----

function createAudioContext(): AudioContext {
  return new AudioContext();
}

function scheduleNote(
  ctx: AudioContext,
  pc: number,
  startTime: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain = 0.3,
): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = BASE_FREQ * Math.pow(2, pc / 12);
  g.gain.value = gain;
  osc.connect(g).connect(ctx.destination);
  osc.start(startTime);
  g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.stop(startTime + duration + 0.05);
}

function scheduleNoiseBurst(ctx: AudioContext, startTime: number, duration: number): void {
  const bufSize = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = buf;
  g.gain.value = 0.15;
  src.connect(g).connect(ctx.destination);
  src.start(startTime);
  g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  src.stop(startTime + duration + 0.05);
}

// ---- Component ----

export default function SketchpadPage() {
  const { user } = useUser();
  const tier = getTier(user?.tier ?? 'free');
  const barLimit = BAR_LIMITS[tier];
  const sketchLimit = SKETCH_LIMITS[tier];

  const {
    sketches,
    currentSketch,
    loading,
    error,
    setError,
    saveSketch,
    deleteSketch,
    updateLocalSketch,
    loadSketchIntoEditor,
    newSketch,
  } = useSketchpad();

  // Local derived state
  const bars = currentSketch.bars;
  const tempo = currentSketch.tempo;
  const stepsTotal = bars * STEPS_PER_BEAT;

  // Tracks parsed from JSON strings
  const melodyNotes: MelodyNote[] = (() => {
    try { return JSON.parse(currentSketch.melody_data) as MelodyNote[]; }
    catch { return []; }
  })();

  const rhythmBeats: (0 | 1)[] = (() => {
    try {
      const arr = JSON.parse(currentSketch.rhythm_data) as number[];
      return arr.map(v => (v ? 1 : 0));
    } catch { return []; }
  })();

  const chordSlots: string[] = (() => {
    try { return JSON.parse(currentSketch.chord_data) as string[]; }
    catch { return []; }
  })();

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [playStep, setPlayStep] = useState(-1);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextStepTimeRef = useRef<number>(0);
  const currentStepRef = useRef<number>(0);

  // UI state
  const [showLoadPanel, setShowLoadPanel] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [chordEditBar, setChordEditBar] = useState<number | null>(null);
  const [chordInput, setChordInput] = useState('');

  // ---- Track editing helpers ----

  function toggleMelodyNote(pc: number, step: number) {
    const exists = melodyNotes.some(n => n.pc === pc && n.step === step);
    const next = exists
      ? melodyNotes.filter(n => !(n.pc === pc && n.step === step))
      : [...melodyNotes, { pc, step }];
    updateLocalSketch({ melody_data: JSON.stringify(next) });
  }

  function toggleRhythmBeat(step: number) {
    const next = [...rhythmBeats];
    while (next.length <= step) next.push(0);
    next[step] = next[step] ? 0 : 1;
    updateLocalSketch({ rhythm_data: JSON.stringify(next) });
  }

  function setChordForBar(barIdx: number, chord: string) {
    const next = [...chordSlots];
    while (next.length <= barIdx) next.push('');
    next[barIdx] = chord;
    updateLocalSketch({ chord_data: JSON.stringify(next) });
    setChordEditBar(null);
    setChordInput('');
  }

  // ---- Playback scheduler ----

  const scheduleStep = useCallback((ctx: AudioContext, step: number, when: number) => {
    const stepDuration = 60 / (tempo * STEPS_PER_BEAT);

    // Melody
    const notesOnStep = melodyNotes.filter(n => n.step === step);
    for (const note of notesOnStep) {
      scheduleNote(ctx, note.pc, when, stepDuration * 0.9, 'sine', 0.25 / Math.max(1, notesOnStep.length));
    }

    // Rhythm
    if (rhythmBeats[step]) {
      scheduleNoiseBurst(ctx, when, stepDuration * 0.5);
    }

    // Chord — play on first step of each bar
    if (step % STEPS_PER_BEAT === 0) {
      const barIdx = Math.floor(step / STEPS_PER_BEAT);
      const chordName = chordSlots[barIdx] ?? '';
      const match = COMMON_CHORDS.find(c => c.label === chordName);
      if (match) {
        const barDuration = stepDuration * STEPS_PER_BEAT;
        for (const pc of match.pcs) {
          scheduleNote(ctx, pc, when, barDuration * 0.9, 'triangle', 0.15 / match.pcs.length);
        }
      }
    }
  }, [melodyNotes, rhythmBeats, chordSlots, tempo]);

  const runScheduler = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const stepDuration = 60 / (tempo * STEPS_PER_BEAT);
    const scheduleAhead = 0.1;

    while (nextStepTimeRef.current < ctx.currentTime + scheduleAhead) {
      const step = currentStepRef.current % stepsTotal;
      scheduleStep(ctx, step, nextStepTimeRef.current);
      setPlayStep(step);
      currentStepRef.current++;
      if (!loop && currentStepRef.current >= stepsTotal) {
        stopPlayback();
        return;
      }
      nextStepTimeRef.current += stepDuration;
    }

    schedulerRef.current = setTimeout(runScheduler, 25);
  }, [scheduleStep, tempo, stepsTotal, loop]);

  function startPlayback() {
    if (isPlaying) return;
    const ctx = createAudioContext();
    audioCtxRef.current = ctx;
    currentStepRef.current = 0;
    nextStepTimeRef.current = ctx.currentTime + 0.05;
    setIsPlaying(true);
    schedulerRef.current = setTimeout(runScheduler, 0);
  }

  function stopPlayback() {
    if (schedulerRef.current) clearTimeout(schedulerRef.current);
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setIsPlaying(false);
    setPlayStep(-1);
  }

  useEffect(() => {
    if (isPlaying) {
      // Restart scheduler when sketch data changes while playing
      if (schedulerRef.current) clearTimeout(schedulerRef.current);
      schedulerRef.current = setTimeout(runScheduler, 0);
    }
  }, [runScheduler, isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopPlayback(); };
  }, []);

  // ---- Save/load ----

  async function handleSave() {
    if (!user) { setError('Please log in to save sketches'); return; }
    setSaveStatus('saving');
    try {
      await saveSketch();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaveStatus('error');
    }
  }

  function handleLoad(sketch: SavedSketch) {
    loadSketchIntoEditor(sketch);
    setShowLoadPanel(false);
  }

  async function handleDelete(id: number) {
    try {
      await deleteSketch(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  // ---- Render ----

  const isMelodyActive = (pc: number, step: number) =>
    melodyNotes.some(n => n.pc === pc && n.step === step);

  const isRhythmActive = (step: number) => (rhythmBeats[step] ?? 0) === 1;

  // Grid columns style (fixed width per step for horizontal scroll)
  const cellW = 24; // px per step cell
  const gridWidth = stepsTotal * cellW;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 space-y-4">

      {/* Tier info banner */}
      {user && (
        <div className="text-xs text-gray-500">
          {tier === 'free' && `Free tier: up to ${SKETCH_LIMITS.free} sketches, ${BAR_LIMITS.free} bars`}
          {tier === 'pro' && `Pro tier: up to ${SKETCH_LIMITS.pro} sketches, ${BAR_LIMITS.pro} bars`}
          {tier === 'research' && 'Research tier: unlimited sketches and bars'}
        </div>
      )}

      {error && (
        <div className="bg-red-900/60 border border-red-700 rounded px-3 py-2 text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 ml-4">✕</button>
        </div>
      )}

      {/* Transport bar */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={isPlaying ? stopPlayback : startPlayback}
            className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
              isPlaying ? 'bg-red-700 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {isPlaying ? '■ Stop' : '▶ Play'}
          </button>
          <button
            onClick={() => setLoop(l => !l)}
            className={`px-3 py-2 rounded text-sm transition-colors ${
              loop ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            ↻ Loop
          </button>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">BPM</label>
            <input
              type="number"
              min={40} max={300}
              value={tempo}
              onChange={e => updateLocalSketch({ tempo: Math.max(40, Math.min(300, parseInt(e.target.value) || 120)) })}
              className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white text-center"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Bars</label>
            <input
              type="number"
              min={1} max={barLimit}
              value={bars}
              onChange={e => {
                const v = Math.max(1, Math.min(barLimit, parseInt(e.target.value) || 8));
                updateLocalSketch({ bars: v });
              }}
              className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white text-center"
            />
            {bars >= barLimit && tier !== 'research' && (
              <span className="text-xs text-amber-400">max for {tier}</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <input
              type="number" min={2} max={16} value={currentSketch.time_sig_top}
              onChange={e => updateLocalSketch({ time_sig_top: Math.max(2, Math.min(16, parseInt(e.target.value) || 4)) })}
              className="w-10 bg-gray-700 border border-gray-600 rounded px-1 py-1 text-center text-white"
            />
            <span>/</span>
            <select
              value={currentSketch.time_sig_bottom}
              onChange={e => updateLocalSketch({ time_sig_bottom: parseInt(e.target.value) })}
              className="bg-gray-700 border border-gray-600 rounded px-1 py-1 text-white text-sm"
            >
              {[2, 4, 8, 16].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Melody Track */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-gray-750 border-b border-gray-700 flex items-center gap-2">
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Melody</span>
          <span className="text-xs text-gray-500">12 pitch classes × {stepsTotal} steps</span>
        </div>
        <div className="overflow-x-auto">
          <div className="relative" style={{ width: `${gridWidth + 48}px` }}>
            {/* Step indicator */}
            <div className="flex ml-12">
              {Array.from({ length: stepsTotal }, (_, s) => (
                <div
                  key={s}
                  className={`flex-none border-r border-gray-700/30 ${
                    s % STEPS_PER_BEAT === 0 ? 'border-l border-gray-600' : ''
                  } ${playStep === s ? 'bg-indigo-900/50' : ''}`}
                  style={{ width: cellW, height: 6 }}
                />
              ))}
            </div>
            {/* Pitch rows (C=0 at bottom, B=11 at top → render reversed) */}
            {[...Array.from({ length: 12 }, (_, i) => 11 - i)].map(pc => (
              <div key={pc} className="flex items-center">
                <div className={`flex-none w-12 text-right pr-2 text-xs ${
                  [1, 3, 6, 8, 10].includes(pc) ? 'text-gray-500' : 'text-gray-300'
                }`}>
                  {PITCH_CLASSES[pc]}
                </div>
                {Array.from({ length: stepsTotal }, (_, s) => (
                  <button
                    key={s}
                    onClick={() => toggleMelodyNote(pc, s)}
                    className={`flex-none border border-gray-700/30 transition-colors ${
                      s % STEPS_PER_BEAT === 0 ? 'border-l-gray-600' : ''
                    } ${
                      isMelodyActive(pc, s)
                        ? 'bg-indigo-500 hover:bg-indigo-400'
                        : [1, 3, 6, 8, 10].includes(pc)
                        ? 'bg-gray-750 hover:bg-indigo-900/50'
                        : 'bg-gray-800 hover:bg-indigo-900/50'
                    } ${playStep === s ? 'ring-1 ring-inset ring-indigo-300/30' : ''}`}
                    style={{ width: cellW, height: 20 }}
                    title={`${PITCH_CLASSES[pc]} step ${s + 1}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rhythm Track */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-700 flex items-center gap-2">
          <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Rhythm</span>
          <span className="text-xs text-gray-500">step sequencer</span>
        </div>
        <div className="overflow-x-auto">
          <div className="flex items-center p-2" style={{ width: `${gridWidth + 48}px` }}>
            <div className="flex-none w-12 text-right pr-2 text-xs text-gray-400">Beat</div>
            {Array.from({ length: stepsTotal }, (_, s) => (
              <button
                key={s}
                onClick={() => toggleRhythmBeat(s)}
                className={`flex-none border border-gray-700/30 rounded-sm transition-colors ${
                  s % STEPS_PER_BEAT === 0 ? 'border-l border-gray-600' : ''
                } ${
                  isRhythmActive(s)
                    ? 'bg-green-500 hover:bg-green-400'
                    : 'bg-gray-700 hover:bg-green-900/50'
                } ${playStep === s ? 'ring-1 ring-green-300/30' : ''}`}
                style={{ width: cellW, height: 32 }}
                title={`Step ${s + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Chord Track */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-700 flex items-center gap-2">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Chords</span>
          <span className="text-xs text-gray-500">one chord per bar</span>
        </div>
        <div className="overflow-x-auto p-2">
          <div className="flex gap-1">
            {Array.from({ length: bars }, (_, b) => (
              <div key={b} className="relative flex-none" style={{ minWidth: cellW * STEPS_PER_BEAT }}>
                <button
                  onClick={() => { setChordEditBar(b); setChordInput(chordSlots[b] ?? ''); }}
                  className={`w-full h-10 rounded border text-xs font-medium transition-colors ${
                    chordSlots[b]
                      ? 'bg-amber-800 border-amber-600 text-amber-200 hover:bg-amber-700'
                      : 'bg-gray-700 border-gray-600 text-gray-500 hover:bg-gray-600'
                  } ${playStep >= 0 && Math.floor(playStep / STEPS_PER_BEAT) === b ? 'ring-2 ring-amber-400' : ''}`}
                >
                  {chordSlots[b] || `Bar ${b + 1}`}
                </button>

                {chordEditBar === b && (
                  <div className="absolute top-full left-0 z-10 mt-1 bg-gray-800 border border-gray-600 rounded-lg p-2 shadow-xl w-48">
                    <input
                      type="text"
                      value={chordInput}
                      onChange={e => setChordInput(e.target.value)}
                      placeholder="e.g. C maj"
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm mb-2"
                      autoFocus
                    />
                    <div className="grid grid-cols-2 gap-1 mb-2">
                      {COMMON_CHORDS.map(c => (
                        <button
                          key={c.label}
                          onClick={() => setChordForBar(b, c.label)}
                          className="text-xs px-1 py-1 bg-gray-700 hover:bg-amber-800 rounded text-left"
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setChordForBar(b, chordInput.trim())}
                        className="flex-1 text-xs px-2 py-1 bg-amber-700 hover:bg-amber-600 rounded"
                      >
                        Set
                      </button>
                      <button
                        onClick={() => setChordForBar(b, '')}
                        className="flex-1 text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => setChordEditBar(null)}
                        className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Save / Load panel */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={currentSketch.name}
          onChange={e => updateLocalSketch({ name: e.target.value })}
          placeholder="Sketch name…"
          className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white flex-1 min-w-0"
        />
        <input
          type="text"
          value={currentSketch.description}
          onChange={e => updateLocalSketch({ description: e.target.value })}
          placeholder="Description (optional)"
          className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-300 flex-1 min-w-0"
        />
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving' || !user}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            saveStatus === 'saved'
              ? 'bg-green-700 text-white'
              : saveStatus === 'error'
              ? 'bg-red-700 text-white'
              : saveStatus === 'saving'
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-emerald-700 hover:bg-emerald-600 text-white'
          } ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={!user ? 'Log in to save' : undefined}
        >
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : 'Save'}
        </button>
        <button
          onClick={newSketch}
          className="px-3 py-1.5 rounded text-sm bg-gray-700 hover:bg-gray-600 text-gray-300"
        >
          New
        </button>
        <button
          onClick={() => setShowLoadPanel(v => !v)}
          className="px-3 py-1.5 rounded text-sm bg-gray-700 hover:bg-gray-600 text-gray-300"
          disabled={!user}
        >
          Load {sketches.length > 0 ? `(${sketches.length})` : '▾'}
        </button>

        {!user && (
          <span className="text-xs text-gray-500">
            <a href="#dashboard" className="text-indigo-400 hover:underline">Log in</a> to save sketches
          </span>
        )}
        {user && sketches.length >= sketchLimit && sketchLimit !== Infinity && (
          <span className="text-xs text-amber-400">
            {sketchLimit} sketch limit reached —{' '}
            <a href="#dashboard" className="underline">upgrade</a>
          </span>
        )}
      </div>

      {/* Load panel dropdown */}
      {showLoadPanel && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-300">Saved Sketches</span>
            <button onClick={() => setShowLoadPanel(false)} className="text-gray-500 hover:text-gray-300 text-xs">✕ Close</button>
          </div>
          {loading && <p className="text-sm text-gray-500">Loading…</p>}
          {!loading && sketches.length === 0 && (
            <p className="text-sm text-gray-500">No saved sketches yet.</p>
          )}
          {sketches.map(sk => (
            <div key={sk.id} className="flex items-center gap-2 p-2 bg-gray-750 rounded border border-gray-700 hover:border-gray-600">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{sk.name}</p>
                <p className="text-xs text-gray-500">{sk.tempo} BPM · {sk.bars} bars · {sk.updated_at.slice(0, 10)}</p>
              </div>
              <button
                onClick={() => handleLoad(sk)}
                className="px-3 py-1 text-xs bg-indigo-700 hover:bg-indigo-600 rounded text-white"
              >
                Load
              </button>
              <button
                onClick={() => handleDelete(sk.id)}
                className="px-2 py-1 text-xs bg-red-900 hover:bg-red-800 rounded text-red-300"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

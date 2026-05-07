import { useState, useEffect, useRef, useCallback } from 'react';
import { classify, NOTE_NAMES, quantizeToSet, voiceLeadingDistance } from '@musical-symmetry/core';
import type { PitchClass } from '@musical-symmetry/core';
import { useUser } from '../context/UserContext';
import { useMidiInput } from '../hooks/useMidiInput';
import { useMidiOutput } from '../hooks/useMidiOutput';

// ── Mini piano keyboard for target set selection ──────────────────────────────

const PIANO_KEYS = Array.from({ length: 12 }, (_, i) => i) as PitchClass[];
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

interface MiniPianoProps {
  selected: PitchClass[];
  onToggle: (pc: PitchClass) => void;
}

function MiniPiano({ selected, onToggle }: MiniPianoProps) {
  return (
    <div className="relative flex h-16 select-none" style={{ width: 168 }}>
      {PIANO_KEYS.map(pc => {
        const isBlack = BLACK_KEYS.has(pc);
        const isSelected = selected.includes(pc);
        return (
          <button
            key={pc}
            onClick={() => onToggle(pc)}
            title={NOTE_NAMES[pc]}
            className={[
              'absolute border border-gray-600 rounded-b cursor-pointer transition-colors',
              isBlack
                ? `z-10 h-10 w-4 top-0 ${isSelected ? 'bg-indigo-500' : 'bg-gray-800 hover:bg-gray-700'}`
                : `h-full w-6 bottom-0 ${isSelected ? 'bg-indigo-400' : 'bg-gray-200 hover:bg-indigo-100'}`
            ].join(' ')}
            style={isBlack ? { left: blackKeyLeft(pc) } : { left: whiteKeyLeft(pc) }}
          />
        );
      })}
    </div>
  );
}

// Compute pixel offsets for white and black keys in a 12-note octave layout
function whiteKeyLeft(pc: PitchClass): number {
  const whiteOrder = [0, 2, 4, 5, 7, 9, 11];
  const idx = whiteOrder.indexOf(pc);
  return idx * 24;
}

function blackKeyLeft(pc: PitchClass): number {
  const offsets: Record<number, number> = { 1: 16, 3: 40, 6: 88, 8: 112, 10: 136 };
  return offsets[pc] ?? 0;
}

// ── Keyboard visualizer ────────────────────────────────────────────────────────

interface KeyboardVisualizerProps {
  activeNotes: Set<number>;
}

function KeyboardVisualizer({ activeNotes }: KeyboardVisualizerProps) {
  const startOctave = 3;
  const endOctave = 6;
  const keys: { midi: number; pc: PitchClass; isBlack: boolean }[] = [];
  for (let oct = startOctave; oct <= endOctave; oct++) {
    for (let pc = 0; pc < 12; pc++) {
      keys.push({ midi: oct * 12 + pc, pc: pc as PitchClass, isBlack: BLACK_KEYS.has(pc) });
    }
  }
  const whiteKeys = keys.filter(k => !k.isBlack);
  const blackKeys = keys.filter(k => k.isBlack);

  return (
    <div className="relative h-20 overflow-hidden bg-gray-900 rounded border border-gray-700">
      <div className="absolute inset-0 flex">
        {whiteKeys.map(({ midi, pc }) => (
          <div
            key={midi}
            className={[
              'flex-1 border border-gray-600 rounded-b-sm transition-colors',
              activeNotes.has(midi) ? 'bg-indigo-400' : 'bg-gray-100',
            ].join(' ')}
            title={`${NOTE_NAMES[pc]}${Math.floor(midi / 12) - 1}`}
          />
        ))}
      </div>
      <div className="absolute inset-0 flex pointer-events-none">
        {/* black keys overlay — approximate positioning */}
        {blackKeys.map(({ midi, pc }) => {
          const octaveOffset = Math.floor(midi / 12) - startOctave;
          const whitePerOctave = 7;
          const totalWhite = whitePerOctave * (endOctave - startOctave + 1);
          const blackPositions: Record<number, number> = { 1: 1, 3: 2, 6: 4, 8: 5, 10: 6 };
          const posInOctave = blackPositions[pc] ?? 0;
          const whiteIdx = octaveOffset * whitePerOctave + posInOctave;
          const leftPct = ((whiteIdx - 0.35) / totalWhite) * 100;
          const widthPct = (0.7 / totalWhite) * 100;
          return (
            <div
              key={midi}
              className={[
                'absolute top-0 h-12 rounded-b-sm z-10 transition-colors',
                activeNotes.has(midi) ? 'bg-indigo-600' : 'bg-gray-800',
              ].join(' ')}
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              title={`${NOTE_NAMES[pc]}${Math.floor(midi / 12) - 1}`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MidiIOPage() {
  const { user } = useUser();
  const isPro = user?.tier === 'pro' || user?.tier === 'research';
  const isResearch = user?.tier === 'research';

  const midi = useMidiInput();
  const midiOut = useMidiOutput();

  // Filter chain state
  const [vlEnabled, setVlEnabled] = useState(false);
  const [transposeEnabled, setTransposeEnabled] = useState(false);
  const [transposeAmount, setTransposeAmount] = useState(0);
  const [quantizeEnabled, setQuantizeEnabled] = useState(false);
  const [targetPcs, setTargetPcs] = useState<PitchClass[]>([0, 2, 4, 5, 7, 9, 11]); // C major

  // Track previous chord for voice-leading optimizer
  const prevNotesRef = useRef<number[]>([]);

  // Live MIDI message handling with output routing
  const activeNotesRef = useRef<Set<number>>(new Set());
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [pitchClasses, setPitchClasses] = useState<PitchClass[]>([]);
  const [inputDevice, setInputDevice] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Timestamps for latency tracking
  const lastMsgTime = useRef<number>(0);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const processAndSendNote = useCallback((midiNote: number, velocity: number, on: boolean) => {
    if (!isPro || !midiOut.selectedOutput) return;
    let note = midiNote;

    if (on) {
      // Apply filter chain in order
      if (transposeEnabled) {
        note = note + transposeAmount;
      }
      if (quantizeEnabled && targetPcs.length > 0) {
        note = quantizeToSet(note, targetPcs);
      }
      if (vlEnabled && prevNotesRef.current.length > 0) {
        // Voice-leading: try to minimize distance from previous chord
        // Simple approach: pick the octave variant closest to prev chord centroid
        const prevPcs = prevNotesRef.current.map(n => (n % 12) as PitchClass);
        const currPc = (note % 12) as PitchClass;
        const candidates: number[] = [];
        for (let oct = 2; oct <= 8; oct++) {
          candidates.push(oct * 12 + currPc);
        }
        // Find candidate that minimizes VL distance from prev PCs
        let bestCandidate = note;
        let bestDist = Infinity;
        for (const cand of candidates) {
          const candPc = (cand % 12) as PitchClass;
          if (prevPcs.length > 0) {
            try {
              const dist = voiceLeadingDistance([candPc], [prevPcs[0]!]);
              if (dist < bestDist) {
                bestDist = dist;
                bestCandidate = cand;
              }
            } catch {
              // different cardinalities — skip
            }
          }
        }
        note = bestCandidate;
      }

      midiOut.sendNoteOn(note, velocity);
      prevNotesRef.current = [...prevNotesRef.current.filter(n => (n % 12) !== (note % 12)), note];
    } else {
      if (transposeEnabled) note = note + transposeAmount;
      if (quantizeEnabled && targetPcs.length > 0) note = quantizeToSet(note, targetPcs);
      midiOut.sendNoteOff(note);
    }
  }, [isPro, midiOut, transposeEnabled, transposeAmount, quantizeEnabled, targetPcs, vlEnabled]);

  const connectMidi = useCallback(async () => {
    try {
      if (!navigator.requestMIDIAccess) {
        setInputError('Web MIDI not supported in this browser');
        return;
      }
      const access = await navigator.requestMIDIAccess();
      const inputs = [...access.inputs.values()];
      if (inputs.length === 0) {
        setInputError('No MIDI input devices found');
        return;
      }
      const input = inputs[0]!;

      input.onmidimessage = (event: WebMidi.MIDIMessageEvent) => {
        if (!event.data) return;
        const now = performance.now();
        setLatencyMs(Math.round(now - lastMsgTime.current));
        lastMsgTime.current = now;

        const [status, note, vel] = event.data;
        const command = (status ?? 0) & 0xf0;
        const noteNum = note ?? 0;
        const velocity = vel ?? 0;

        if (command === 0x90 && velocity > 0) {
          activeNotesRef.current.add(noteNum);
          processAndSendNote(noteNum, velocity, true);
        } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
          activeNotesRef.current.delete(noteNum);
          processAndSendNote(noteNum, 0, false);
        }

        const snapshot = new Set(activeNotesRef.current);
        setActiveNotes(snapshot);
        const pcs = [...new Set([...snapshot].map(n => (n % 12) as PitchClass))].sort((a, b) => a - b);
        setPitchClasses(pcs);
      };

      setInputDevice(input.name ?? 'MIDI Device');
      setIsConnected(true);
      setInputError(null);

      access.onstatechange = () => {
        const current = [...access.inputs.values()];
        if (current.length === 0) {
          setIsConnected(false);
          setInputDevice(null);
        }
      };
    } catch (err) {
      setInputError(err instanceof Error ? err.message : 'Failed to connect MIDI');
    }
  }, [processAndSendNote]);

  // Classification
  const analysis = pitchClasses.length > 0 ? classify(pitchClasses) : null;

  const toggleTargetPc = useCallback((pc: PitchClass) => {
    setTargetPcs(prev =>
      prev.includes(pc) ? prev.filter(p => p !== pc) : [...prev, pc].sort((a, b) => a - b)
    );
  }, []);

  const isAvailable = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;

  return (
    <div className="space-y-6">
      {/* Header status bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700 text-sm">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-500'}`} />
          <span className="text-gray-300">In: {inputDevice ?? 'Not connected'}</span>
        </div>
        <span className="text-gray-600">|</span>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${midiOut.selectedOutput ? 'bg-blue-400' : 'bg-gray-500'}`} />
          <span className="text-gray-300">Out: {midiOut.selectedOutput?.name ?? 'None'}</span>
        </div>
        <span className="text-gray-600">|</span>
        <span className="text-gray-400">Notes held: {activeNotes.size}</span>
        {latencyMs !== null && (
          <>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">Latency: {latencyMs}ms</span>
          </>
        )}
        {!isPro && (
          <>
            <span className="text-gray-600">|</span>
            <span className="text-amber-400 text-xs font-medium">Free tier — output & filters require Pro</span>
          </>
        )}
        {isResearch && (
          <>
            <span className="text-gray-600">|</span>
            <span className="text-purple-400 text-xs font-medium">Research — multi-channel routing available</span>
          </>
        )}
      </div>

      {!isAvailable ? (
        <div className="p-6 bg-gray-800 rounded-lg border border-gray-700 text-center">
          <p className="text-gray-400">Web MIDI API is not supported in this browser.</p>
          <p className="text-gray-500 text-sm mt-1">Try Chrome or Edge for MIDI support.</p>
        </div>
      ) : (
        <>
          {/* Device section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* MIDI Input */}
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">MIDI Input</h2>
              {inputError && (
                <p className="text-red-400 text-sm mb-2">{inputError}</p>
              )}
              {!isConnected ? (
                <button
                  onClick={connectMidi}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium transition-colors"
                >
                  Connect MIDI Input
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-green-300 text-sm">{inputDevice}</span>
                </div>
              )}
            </div>

            {/* MIDI Output */}
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
                MIDI Output
                {!isPro && <span className="ml-2 text-xs text-amber-400 font-normal">(Pro)</span>}
              </h2>
              {isPro ? (
                midiOut.outputs.length === 0 ? (
                  <p className="text-gray-500 text-sm">No MIDI output devices found</p>
                ) : (
                  <select
                    value={midiOut.selectedOutput?.id ?? ''}
                    onChange={e => {
                      const found = midiOut.outputs.find(o => o.id === e.target.value) ?? null;
                      midiOut.setSelectedOutput(found);
                    }}
                    className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- No output --</option>
                    {midiOut.outputs.map(o => (
                      <option key={o.id} value={o.id}>{o.name ?? o.id}</option>
                    ))}
                  </select>
                )
              ) : (
                <p className="text-gray-500 text-sm">Upgrade to Pro to route MIDI output</p>
              )}
            </div>
          </div>

          {/* Live display */}
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Live Display</h2>
            <KeyboardVisualizer activeNotes={activeNotes} />

            {pitchClasses.length > 0 && analysis ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="p-2 bg-gray-700 rounded">
                  <div className="text-gray-400 text-xs mb-1">Notes</div>
                  <div className="text-white font-mono">
                    {pitchClasses.map(pc => NOTE_NAMES[pc]).join(' ')}
                  </div>
                </div>
                <div className="p-2 bg-gray-700 rounded">
                  <div className="text-gray-400 text-xs mb-1">Forte</div>
                  <div className="text-indigo-300 font-mono">
                    {analysis.characterTableEntry?.forteNumber ?? '—'}
                  </div>
                </div>
                <div className="p-2 bg-gray-700 rounded">
                  <div className="text-gray-400 text-xs mb-1">Symmetry Group</div>
                  <div className="text-purple-300 font-mono">{analysis.abstractGroup}</div>
                </div>
                <div className="p-2 bg-gray-700 rounded">
                  <div className="text-gray-400 text-xs mb-1">Mulliken</div>
                  <div className="text-teal-300 font-mono">{analysis.mullikenLabel}</div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm italic">
                {isConnected ? 'Play notes to see analysis…' : 'Connect MIDI input to begin'}
              </p>
            )}
          </div>

          {/* Filter chain — Pro only */}
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Filter Chain</h2>
              {!isPro && <span className="text-xs text-amber-400">(Pro feature)</span>}
            </div>

            {!isPro ? (
              <p className="text-gray-500 text-sm">Upgrade to Pro to access theory-aware MIDI filters.</p>
            ) : (
              <div className="space-y-4">
                {/* Filter 1: Voice-leading optimizer */}
                <div className="p-3 bg-gray-750 border border-gray-600 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-gray-200 text-sm font-medium">1. Voice-Leading Optimizer</span>
                      <p className="text-gray-500 text-xs mt-0.5">Re-voices output to minimize voice-leading distance from previous chord</p>
                    </div>
                    <button
                      onClick={() => setVlEnabled(v => !v)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${vlEnabled ? 'bg-indigo-600' : 'bg-gray-600'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${vlEnabled ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Filter 2: Transpose */}
                <div className="p-3 border border-gray-600 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-gray-200 text-sm font-medium">2. Transpose</span>
                      <p className="text-gray-500 text-xs mt-0.5">Shift all notes by semitones</p>
                    </div>
                    <button
                      onClick={() => setTransposeEnabled(v => !v)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${transposeEnabled ? 'bg-indigo-600' : 'bg-gray-600'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${transposeEnabled ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                  {transposeEnabled && (
                    <div className="flex items-center gap-3 mt-2">
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        value={transposeAmount}
                        onChange={e => setTransposeAmount(Number(e.target.value))}
                        className="flex-1 accent-indigo-500"
                      />
                      <span className="text-gray-300 text-sm w-12 text-right font-mono">
                        {transposeAmount >= 0 ? `+${transposeAmount}` : transposeAmount} st
                      </span>
                    </div>
                  )}
                </div>

                {/* Filter 3: Set-class quantize */}
                <div className="p-3 border border-gray-600 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-gray-200 text-sm font-medium">3. Set-Class Quantize</span>
                      <p className="text-gray-500 text-xs mt-0.5">Snap notes to nearest member of target set</p>
                    </div>
                    <button
                      onClick={() => setQuantizeEnabled(v => !v)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${quantizeEnabled ? 'bg-indigo-600' : 'bg-gray-600'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${quantizeEnabled ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                  {quantizeEnabled && (
                    <div className="mt-3 space-y-2">
                      <div className="text-xs text-gray-400">
                        Target: {targetPcs.length === 0 ? 'none' : targetPcs.map(pc => NOTE_NAMES[pc]).join(' ')}
                      </div>
                      <MiniPiano selected={targetPcs} onToggle={toggleTargetPc} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Research: multi-channel info */}
          {isResearch && (
            <div className="p-4 bg-gray-800 rounded-lg border border-purple-700 space-y-2">
              <h2 className="text-sm font-semibold text-purple-300 uppercase tracking-wide">Research: Multi-Channel Routing</h2>
              <p className="text-gray-400 text-sm">
                Research tier unlocks per-channel MIDI routing. Each MIDI channel (1–16) can be assigned
                a separate output device and filter chain. Full implementation coming in a future release.
              </p>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {Array.from({ length: 16 }, (_, i) => (
                  <div key={i} className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-400 text-center">
                    Ch {i + 1}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

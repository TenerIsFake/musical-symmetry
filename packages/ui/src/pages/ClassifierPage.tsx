import { useReducer, useEffect, useState, useCallback, useRef } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';
import { useClassifier } from '../hooks/useClassifier';
import { useChord } from '../hooks/useChord';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useLiveMidi } from '../hooks/useLiveMidi';
import { useUser } from '../context/UserContext';
import PianoKeyboard from '../components/PianoKeyboard';
import TextInput from '../components/TextInput';
import Presets from '../components/Presets';
import ClassificationPanel from '../components/ClassificationPanel';
import ProgressionPanel from '../components/ProgressionPanel';
import OrbitDiagram from '../components/OrbitDiagram';
import TonnetzViz from '../components/TonnetzViz';
import ModeExplorer from '../components/ModeExplorer';
import ComparePanel from '../components/ComparePanel';
import AudioControls from '../components/AudioControls';
import MicControls from '../components/MicControls';
import SharePanel from '../components/SharePanel';
import GuidedTour from '../components/GuidedTour';
import ChordHistory, { buildHistoryEntry } from '../components/ChordHistory';
import type { HistoryEntry } from '../components/ChordHistory';
import SaveButton from '../components/SaveButton';
import CollectionsSidebar from '../components/CollectionsSidebar';
import MidiInput from '../components/MidiInput';
import ExportMenu from '../components/ExportMenu';

export type Action =
  | { type: 'TOGGLE_PC'; pc: PitchClass }
  | { type: 'SET_PCS'; pcs: PitchClass[] }
  | { type: 'CLEAR' }
  | { type: 'UNDO' }
  | { type: 'REDO' };

export interface AppState {
  selectedPCs: PitchClass[];
  undoStack: PitchClass[][];
  redoStack: PitchClass[][];
}

function parseURLPCs(): PitchClass[] {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const pcsParam = params.get('pcs');
  if (!pcsParam) return [];
  const pcs = pcsParam.split(',').map(Number).filter(n => n >= 0 && n <= 11) as PitchClass[];
  return [...new Set(pcs)].sort((a, b) => a - b);
}

const initialState: AppState = {
  selectedPCs: parseURLPCs(),
  undoStack: [],
  redoStack: [],
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'TOGGLE_PC': {
      const has = state.selectedPCs.includes(action.pc);
      return {
        selectedPCs: has
          ? state.selectedPCs.filter(p => p !== action.pc)
          : [...state.selectedPCs, action.pc].sort((a, b) => a - b),
        undoStack: [...state.undoStack, state.selectedPCs],
        redoStack: [],
      };
    }
    case 'SET_PCS':
      return {
        selectedPCs: [...action.pcs].sort((a, b) => a - b),
        undoStack: [...state.undoStack, state.selectedPCs],
        redoStack: [],
      };
    case 'CLEAR':
      return {
        selectedPCs: [],
        undoStack: [...state.undoStack, state.selectedPCs],
        redoStack: [],
      };
    case 'UNDO': {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      return {
        selectedPCs: prev,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, state.selectedPCs],
      };
    }
    case 'REDO': {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      return {
        selectedPCs: next,
        undoStack: [...state.undoStack, state.selectedPCs],
        redoStack: state.redoStack.slice(0, -1),
      };
    }
    default:
      return state;
  }
}

function formatSessionTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function ClassifierPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [showShare, setShowShare] = useState(false);
  const [showTour, setShowTour] = useState(() => localStorage.getItem('tour-completed') !== 'true');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const analysis = useClassifier(state.selectedPCs);
  const chord = useChord(state.selectedPCs);
  const prevAnalysisRef = useRef<string | null>(null);
  const { user } = useUser();
  const liveMidi = useLiveMidi();
  const isFree = !user || user.tier === 'free';

  // Keyboard shortcuts
  const keyboardActions = useCallback(
    () => ({
      togglePC: (pc: PitchClass) => dispatch({ type: 'TOGGLE_PC', pc }),
      clear: () => dispatch({ type: 'CLEAR' }),
      undo: () => dispatch({ type: 'UNDO' }),
      redo: () => dispatch({ type: 'REDO' }),
    }),
    [],
  );
  useKeyboardShortcuts(keyboardActions());

  // Sync live MIDI pitch classes into classifier when live mode is active
  useEffect(() => {
    if (!liveMidi.isLive) return;
    dispatch({ type: 'SET_PCS', pcs: liveMidi.pitchClasses });
  }, [liveMidi.isLive, liveMidi.pitchClasses]);

  // Track analysis changes and add to history
  useEffect(() => {
    if (!analysis) {
      prevAnalysisRef.current = null;
      return;
    }
    const key = analysis.pitchClasses.join(',');
    if (key === prevAnalysisRef.current) return;
    prevAnalysisRef.current = key;

    const chordName = chord
      ? `${NOTE_NAMES[chord.root]} ${chord.quality}`
      : null;
    const entry = buildHistoryEntry(
      state.selectedPCs,
      chordName,
      analysis.abstractGroup,
    );
    setHistory((prev) => [entry, ...prev].slice(0, 20));
  }, [analysis, chord, state.selectedPCs]);

  useEffect(() => {
    const base = '#classifier';
    if (state.selectedPCs.length > 0) {
      const url = `${base}?pcs=${state.selectedPCs.join(',')}`;
      window.history.replaceState(null, '', url);
    } else {
      window.history.replaceState(null, '', base);
    }
  }, [state.selectedPCs]);

  return (
    <>
      {state.selectedPCs.length === 0 && (
        <div className="mb-6 text-center py-8">
          <p className="text-2xl font-bold text-white mb-2">Click any key to begin</p>
          <p className="text-gray-400 text-sm">
            Select notes on the piano, type them in, or try a preset below
          </p>
          <div className="mt-4 flex justify-center">
            <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          </div>
        </div>
      )}
      <main className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-4 sm:space-y-6">
          <MidiInput onNotesChange={(pcs) => dispatch({ type: 'SET_PCS', pcs })} />

          {/* MIDI Live Mode controls */}
          {liveMidi.isAvailable && (
            <div className="bg-gray-800 rounded-lg p-3 flex flex-wrap items-center gap-3">
              <button
                onClick={liveMidi.toggleLive}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  liveMidi.isLive
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                }`}
                title="Toggle MIDI keyboard live input mode"
              >
                {liveMidi.isLive ? '● MIDI Live' : 'MIDI Live'}
              </button>

              {liveMidi.isLive && (
                <>
                  <button
                    onClick={liveMidi.toggleSustain}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      liveMidi.sustained
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    }`}
                    title="Freeze current notes (sustain)"
                  >
                    {liveMidi.sustained ? 'Sustained' : 'Sustain'}
                  </button>

                  {liveMidi.deviceName && (
                    <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                      {liveMidi.deviceName}
                    </span>
                  )}

                  {isFree && (
                    <span className="ml-auto text-xs text-gray-400 font-mono tabular-nums">
                      {formatSessionTime(liveMidi.sessionElapsed)} / 05:00
                    </span>
                  )}
                </>
              )}

              {!liveMidi.isLive && liveMidi.deviceName && (
                <span className="text-xs text-gray-500">Last: {liveMidi.deviceName}</span>
              )}
            </div>
          )}

          {/* Free tier session limit banner */}
          {liveMidi.sessionLimitReached && (
            <div className="bg-amber-900/60 border border-amber-600 rounded-lg px-4 py-2 text-sm text-amber-200">
              Free tier: 5-minute MIDI session reached. Upgrade to Pro for unlimited.
            </div>
          )}

          {/* MIDI disconnected banner (was live, now disconnected) */}
          {liveMidi.isLive && !liveMidi.deviceName && (
            <div className="bg-red-900/60 border border-red-600 rounded-lg px-4 py-2 text-sm text-red-200">
              MIDI disconnected — analysis frozen at last state.
            </div>
          )}

          <div data-tour="piano">
            <PianoKeyboard
              selectedPCs={state.selectedPCs}
              onToggle={(pc) => dispatch({ type: 'TOGGLE_PC', pc })}
            />
            <p className="mt-1 text-xs text-gray-500 text-center">
              Type a–j for notes, w/e/t/y/u for sharps
            </p>
          </div>
          <div data-tour="presets">
            <Presets
              onSelect={(pcs) => dispatch({ type: 'SET_PCS', pcs })}
              currentPCs={state.selectedPCs}
            />
          </div>
          <div data-tour="classification">
            <ClassificationPanel analysis={analysis} chord={chord} />
          </div>
          <ComparePanel currentPCs={state.selectedPCs} currentAnalysis={analysis} />
          <ProgressionPanel chord={chord} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AudioControls selectedPCs={state.selectedPCs} />
            <MicControls onDetect={(pc) => dispatch({ type: 'TOGGLE_PC', pc })} />
          </div>
          <TextInput onSetPCs={(pcs) => dispatch({ type: 'SET_PCS', pcs })} />
        </div>
        <div className="space-y-4 sm:space-y-6">
          <div data-tour="orbit">
            <OrbitDiagram selectedPCs={state.selectedPCs} analysis={analysis} onTogglePC={(pc) => dispatch({ type: 'TOGGLE_PC', pc })} />
          </div>
          <TonnetzViz chord={chord} targetChord={null} onChordChange={(c) => dispatch({ type: 'SET_PCS', pcs: c.pitchClasses as PitchClass[] })} />
          <ModeExplorer
            selectedPCs={state.selectedPCs}
            onSelectMode={(pcs) => dispatch({ type: 'SET_PCS', pcs })}
          />
          <ChordHistory
            entries={history}
            onRestore={(pcs) => dispatch({ type: 'SET_PCS', pcs })}
            onClear={() => setHistory([])}
          />
          <CollectionsSidebar
            onLoadPcs={(pcs) => dispatch({ type: 'SET_PCS', pcs })}
          />
        </div>
      </main>
      <div className="mt-4 flex gap-3">
        <button
          onClick={() => dispatch({ type: 'UNDO' })}
          disabled={state.undoStack.length === 0}
          className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          &#8592; Undo
        </button>
        <button
          onClick={() => dispatch({ type: 'REDO' })}
          disabled={state.redoStack.length === 0}
          className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo &#8594;
        </button>
        <button
          onClick={() => dispatch({ type: 'CLEAR' })}
          className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 text-sm font-medium"
        >
          Clear All
        </button>
        {state.selectedPCs.length >= 2 && (
          <button
            data-tour="share"
            onClick={() => setShowShare(true)}
            className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-500 text-sm font-medium text-white"
          >
            Share
          </button>
        )}
        {state.selectedPCs.length < 2 && (
          <span data-tour="share" className="px-4 py-2 bg-gray-700 rounded text-sm font-medium text-gray-500 cursor-not-allowed">
            Share
          </span>
        )}
        <SaveButton
          type="classifier"
          data={{ pitchClasses: state.selectedPCs, chord: chord ? `${NOTE_NAMES[chord.root]} ${chord.quality}` : undefined }}
          defaultName={chord ? `${NOTE_NAMES[chord.root]} ${chord.quality}` : `Set {${state.selectedPCs.join(',')}}`}
        />
        <ExportMenu analysis={analysis} pcs={state.selectedPCs} />
      </div>
      {showShare && (
        <SharePanel
          pcs={state.selectedPCs}
          chordName={chord ? `${NOTE_NAMES[chord.root]} ${chord.quality}` : undefined}
          group={analysis?.abstractGroup}
          onClose={() => setShowShare(false)}
        />
      )}
      {showTour && <GuidedTour onComplete={() => setShowTour(false)} />}
    </>
  );
}

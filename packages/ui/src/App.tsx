import { useReducer } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';
import { useClassifier } from './hooks/useClassifier';
import { useChord } from './hooks/useChord';
import PianoKeyboard from './components/PianoKeyboard';

export type Action =
  | { type: 'TOGGLE_PC'; pc: PitchClass }
  | { type: 'SET_PCS'; pcs: PitchClass[] }
  | { type: 'CLEAR' };

export interface AppState {
  selectedPCs: PitchClass[];
}

const initialState: AppState = { selectedPCs: [] };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'TOGGLE_PC': {
      const has = state.selectedPCs.includes(action.pc);
      return {
        selectedPCs: has
          ? state.selectedPCs.filter(p => p !== action.pc)
          : [...state.selectedPCs, action.pc].sort((a, b) => a - b),
      };
    }
    case 'SET_PCS':
      return { selectedPCs: [...action.pcs].sort((a, b) => a - b) };
    case 'CLEAR':
      return { selectedPCs: [] };
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const analysis = useClassifier(state.selectedPCs);
  const chord = useChord(state.selectedPCs);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Musical Symmetry Classifier</h1>
        <p className="text-gray-400 mt-1">
          Select pitch classes to analyze symmetry groups and explore progressions
        </p>
      </header>
      <main className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <PianoKeyboard
            selectedPCs={state.selectedPCs}
            onToggle={(pc) => dispatch({ type: 'TOGGLE_PC', pc })}
          />

          {analysis && (
            <div className="bg-gray-800 rounded-lg p-4 space-y-2">
              <h2 className="text-sm font-semibold text-gray-400 uppercase">Symmetry Analysis</h2>
              <p className="text-white">
                <span className="text-gray-400">Group:</span>{' '}
                <span className="font-mono">{analysis.abstractGroup}</span>
              </p>
              {analysis.mullikenLabel && (
                <p className="text-white">
                  <span className="text-gray-400">Mulliken label:</span>{' '}
                  <span className="font-mono">{analysis.mullikenLabel}</span>
                </p>
              )}
              <p className="text-white">
                <span className="text-gray-400">Stabilizer order:</span>{' '}
                <span className="font-mono">{analysis.stabilizerOrder}</span>
              </p>
            </div>
          )}

          {chord && (
            <div className="bg-gray-800 rounded-lg p-4 space-y-2">
              <h2 className="text-sm font-semibold text-gray-400 uppercase">Chord</h2>
              <p className="text-white font-mono text-lg">
                {NOTE_NAMES[chord.root]} {chord.quality}
              </p>
            </div>
          )}

          {state.selectedPCs.length === 0 && (
            <p className="text-gray-500 text-sm">Click keys on the piano to select pitch classes.</p>
          )}

          {state.selectedPCs.length > 0 && (
            <button
              onClick={() => dispatch({ type: 'CLEAR' })}
              className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 text-sm"
            >
              Clear
            </button>
          )}
        </div>
        <div className="space-y-6">
          {/* Visualizations go here */}
        </div>
      </main>
    </div>
  );
}

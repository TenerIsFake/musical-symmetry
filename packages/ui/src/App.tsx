import { useReducer } from 'react';
import type { PitchClass } from '@musical-symmetry/core';

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
          <p className="text-gray-500">
            Selected: {JSON.stringify(state.selectedPCs)}
          </p>
          <button
            onClick={() => dispatch({ type: 'CLEAR' })}
            className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
        <div className="space-y-6">
          {/* Visualizations go here */}
        </div>
      </main>
    </div>
  );
}

import { useReducer, useEffect, useState } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';
import { useClassifier } from '../hooks/useClassifier';
import { useChord } from '../hooks/useChord';
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

export type Action =
  | { type: 'TOGGLE_PC'; pc: PitchClass }
  | { type: 'SET_PCS'; pcs: PitchClass[] }
  | { type: 'CLEAR' };

export interface AppState {
  selectedPCs: PitchClass[];
}

function parseURLPCs(): PitchClass[] {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const pcsParam = params.get('pcs');
  if (!pcsParam) return [];
  const pcs = pcsParam.split(',').map(Number).filter(n => n >= 0 && n <= 11) as PitchClass[];
  return [...new Set(pcs)].sort((a, b) => a - b);
}

const initialState: AppState = { selectedPCs: parseURLPCs() };

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

export default function ClassifierPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [showShare, setShowShare] = useState(false);
  const analysis = useClassifier(state.selectedPCs);
  const chord = useChord(state.selectedPCs);

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
      <main className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-4 sm:space-y-6">
          <PianoKeyboard
            selectedPCs={state.selectedPCs}
            onToggle={(pc) => dispatch({ type: 'TOGGLE_PC', pc })}
          />
          <Presets
            onSelect={(pcs) => dispatch({ type: 'SET_PCS', pcs })}
            currentPCs={state.selectedPCs}
          />
          <ClassificationPanel analysis={analysis} chord={chord} />
          <ComparePanel currentPCs={state.selectedPCs} currentAnalysis={analysis} />
          <ProgressionPanel chord={chord} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AudioControls selectedPCs={state.selectedPCs} />
            <MicControls onDetect={(pc) => dispatch({ type: 'TOGGLE_PC', pc })} />
          </div>
          <TextInput onSetPCs={(pcs) => dispatch({ type: 'SET_PCS', pcs })} />
        </div>
        <div className="space-y-4 sm:space-y-6">
          <OrbitDiagram selectedPCs={state.selectedPCs} analysis={analysis} />
          <TonnetzViz chord={chord} targetChord={null} />
          <ModeExplorer
            selectedPCs={state.selectedPCs}
            onSelectMode={(pcs) => dispatch({ type: 'SET_PCS', pcs })}
          />
        </div>
      </main>
      <div className="mt-4 flex gap-3">
        <button
          onClick={() => dispatch({ type: 'CLEAR' })}
          className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 text-sm font-medium"
        >
          Clear All
        </button>
        {state.selectedPCs.length >= 2 && (
          <button
            onClick={() => setShowShare(true)}
            className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-500 text-sm font-medium text-white"
          >
            Share
          </button>
        )}
      </div>
      {showShare && (
        <SharePanel
          pcs={state.selectedPCs}
          chordName={chord ? `${NOTE_NAMES[chord.root]} ${chord.quality}` : undefined}
          group={analysis?.abstractGroup}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
}

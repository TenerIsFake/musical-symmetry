import type { PitchClass } from '@musical-symmetry/core';
import { useAudio } from '../hooks/useAudio';

interface Props {
  selectedPCs: PitchClass[];
}

export default function AudioControls({ selectedPCs }: Props) {
  const { playChord, playArpeggio, stop } = useAudio();

  const disabled = selectedPCs.length === 0;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Audio</h2>
      <div className="flex gap-2">
        <button
          disabled={disabled}
          onClick={() => playChord(selectedPCs)}
          className="px-3 py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          Play Chord
        </button>
        <button
          disabled={disabled}
          onClick={() => playArpeggio(selectedPCs)}
          className="px-3 py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          Arpeggio
        </button>
        <button
          onClick={stop}
          className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm font-medium transition-colors"
        >
          Stop
        </button>
      </div>
    </div>
  );
}

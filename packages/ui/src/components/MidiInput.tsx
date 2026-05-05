import type { PitchClass } from '@musical-symmetry/core';
import { useMidiInput } from '../hooks/useMidiInput';
import { useEffect } from 'react';

interface Props {
  onNotesChange: (pcs: PitchClass[]) => void;
}

export default function MidiInput({ onNotesChange }: Props) {
  const { connected, deviceName, pitchClasses, error, connect, disconnect } = useMidiInput();

  useEffect(() => {
    if (pitchClasses.length > 0) {
      onNotesChange(pitchClasses);
    }
  }, [pitchClasses, onNotesChange]);

  return (
    <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-600'}`} />
      {connected ? (
        <>
          <span className="text-sm text-gray-300">{deviceName}</span>
          <span className="text-xs text-gray-500">({pitchClasses.length} notes held)</span>
          <button onClick={disconnect} className="ml-auto text-xs text-red-400 hover:text-red-300">
            Disconnect
          </button>
        </>
      ) : (
        <>
          <button
            onClick={connect}
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            Connect MIDI Keyboard
          </button>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </>
      )}
    </div>
  );
}

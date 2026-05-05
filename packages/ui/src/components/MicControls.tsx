import { useEffect, useRef } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';
import { useMicPitchDetect } from '../hooks/useMicPitchDetect';

interface Props {
  onDetect: (pc: PitchClass) => void;
}

export default function MicControls({ onDetect }: Props) {
  const { isListening, detectedPC, error, start, stop } = useMicPitchDetect();
  const lastPCRef = useRef<PitchClass | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (detectedPC !== null && detectedPC !== lastPCRef.current) {
      lastPCRef.current = detectedPC;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onDetect(detectedPC);
      }, 200);
    }
  }, [detectedPC, onDetect]);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Live Microphone</h2>
      <div className="flex items-center gap-4">
        {!isListening ? (
          <button
            onClick={start}
            className="px-4 py-2 rounded bg-red-700 hover:bg-red-600 text-sm font-medium transition-colors flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            Start Listening
          </button>
        ) : (
          <button
            onClick={stop}
            className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 text-sm font-medium transition-colors"
          >
            Stop
          </button>
        )}

        {isListening && detectedPC !== null && (
          <span className="text-lg font-mono text-green-400">
            {NOTE_NAMES[detectedPC]}
          </span>
        )}

        {isListening && detectedPC === null && (
          <span className="text-sm text-gray-500 italic">Listening...</span>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-xs mt-2">{error}</p>
      )}
    </div>
  );
}

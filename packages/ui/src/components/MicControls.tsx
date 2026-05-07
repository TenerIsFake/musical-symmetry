import { useEffect, useRef, useState, useCallback } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';
import { useMicPitchDetect } from '../hooks/useMicPitchDetect';
import { frequencyToNoteName } from '../utils/pitch-detect';

interface Props {
  onDetect: (pc: PitchClass) => void;
  /** If provided, show accumulated PCs and classify/clear buttons */
  showAccumulator?: boolean;
  /** Called when user clicks Classify with accumulated PCs */
  onClassify?: (pcs: PitchClass[]) => void;
}

export default function MicControls({ onDetect, showAccumulator = false, onClassify }: Props) {
  const { isListening, detectedPC, detectedFreq, error, start, stop } = useMicPitchDetect();
  const lastPCRef = useRef<PitchClass | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [accumulatedPCs, setAccumulatedPCs] = useState<Set<PitchClass>>(new Set());

  // Debounce onDetect and accumulate pitch classes
  useEffect(() => {
    if (detectedPC !== null && detectedPC !== lastPCRef.current) {
      lastPCRef.current = detectedPC;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onDetect(detectedPC);
        if (showAccumulator) {
          setAccumulatedPCs(prev => {
            const next = new Set(prev);
            next.add(detectedPC);
            return next;
          });
        }
      }, 200);
    }
  }, [detectedPC, onDetect, showAccumulator]);

  // Clear accumulated PCs when not listening
  useEffect(() => {
    if (!isListening) {
      lastPCRef.current = null;
    }
  }, [isListening]);

  const handleClear = useCallback(() => {
    setAccumulatedPCs(new Set());
    lastPCRef.current = null;
  }, []);

  const handleClassify = useCallback(() => {
    if (onClassify && accumulatedPCs.size >= 2) {
      const sorted = [...accumulatedPCs].sort((a, b) => a - b) as PitchClass[];
      onClassify(sorted);
    }
  }, [onClassify, accumulatedPCs]);

  // Compute note display info from frequency
  const noteInfo = detectedFreq !== undefined && detectedFreq !== null && isListening && detectedPC !== null
    ? frequencyToNoteName(detectedFreq)
    : null;

  // Cents indicator: clamp to [-50, 50]
  const centsOffset = noteInfo ? Math.max(-50, Math.min(50, noteInfo.cents)) : 0;
  const centsPercent = ((centsOffset + 50) / 100) * 100; // 0-100%

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Live Microphone</h2>

      <div className="flex items-center gap-4 mb-3">
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

        {isListening && detectedPC !== null && noteInfo && (
          <div className="flex flex-col items-center">
            <span className="text-xl font-mono text-green-400 leading-none">
              {noteInfo.note}<sub className="text-sm text-green-600">{noteInfo.octave}</sub>
            </span>
            <span className={`text-xs font-mono mt-0.5 ${Math.abs(noteInfo.cents) <= 10 ? 'text-green-400' : 'text-yellow-400'}`}>
              {noteInfo.cents > 0 ? '+' : ''}{noteInfo.cents}¢
            </span>
          </div>
        )}

        {isListening && detectedPC === null && (
          <span className="text-sm text-gray-500 italic">Listening...</span>
        )}
      </div>

      {/* Tuner cents indicator */}
      {isListening && noteInfo && (
        <div className="mb-3">
          <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
            {/* Center tick */}
            <div className="absolute left-1/2 top-0 w-0.5 h-full bg-gray-500 -translate-x-0.5" />
            {/* Cents needle */}
            <div
              className={`absolute top-0.5 w-1.5 h-1 rounded-full transition-all duration-100 -translate-x-1/2 ${
                Math.abs(noteInfo.cents) <= 10 ? 'bg-green-400' : Math.abs(noteInfo.cents) <= 25 ? 'bg-yellow-400' : 'bg-red-400'
              }`}
              style={{ left: `${centsPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-0.5">
            <span>-50¢</span>
            <span>in tune</span>
            <span>+50¢</span>
          </div>
        </div>
      )}

      {/* Accumulated pitch classes */}
      {showAccumulator && (
        <div className="border-t border-gray-700 pt-3 mt-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase font-semibold">Detected Notes</span>
            <div className="flex gap-2">
              <button
                onClick={handleClear}
                className="px-2 py-0.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300"
              >
                Clear
              </button>
              <button
                onClick={handleClassify}
                disabled={accumulatedPCs.size < 2}
                className="px-2 py-0.5 rounded text-xs bg-indigo-700 hover:bg-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Classify
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 min-h-[24px]">
            {accumulatedPCs.size === 0 ? (
              <span className="text-xs text-gray-600 italic">none yet</span>
            ) : (
              [...accumulatedPCs].sort((a, b) => a - b).map(pc => (
                <span
                  key={pc}
                  className="px-2 py-0.5 rounded bg-indigo-900 text-indigo-300 text-xs font-mono"
                >
                  {NOTE_NAMES[pc]}
                </span>
              ))
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-xs mt-2">{error}</p>
      )}
    </div>
  );
}

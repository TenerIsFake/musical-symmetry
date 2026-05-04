import { useMemo } from 'react';
import { analyzeModes, NOTE_NAMES } from '@musical-symmetry/core';
import type { PitchClass, ModeAnalysis } from '@musical-symmetry/core';

interface Props {
  selectedPCs: PitchClass[];
  onSelectMode: (pcs: PitchClass[]) => void;
}

function BrightnessBar({ index }: { index: number }) {
  const normalized = (index + 3) / 6;
  const width = Math.max(5, Math.min(100, normalized * 100));
  const color = index > 0 ? 'bg-yellow-400' : index < 0 ? 'bg-blue-400' : 'bg-gray-400';
  return (
    <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${width}%` }} />
    </div>
  );
}

export default function ModeExplorer({ selectedPCs, onSelectMode }: Props) {
  const modes = useMemo(() => {
    if (selectedPCs.length !== 7) return [];
    return analyzeModes(selectedPCs);
  }, [selectedPCs.join(',')]);

  if (selectedPCs.length !== 7) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Mode Explorer</h2>
        <p className="text-gray-500 text-sm italic">Select exactly 7 pitch classes to explore modes</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Mode Explorer</h2>
      <div className="space-y-2">
        {modes.map((mode: ModeAnalysis, i: number) => (
          <button
            key={i}
            onClick={() => {
              const pcs = mode.intervalPattern.reduce<PitchClass[]>(
                (acc, interval) => {
                  const last = acc[acc.length - 1]!;
                  const next = ((last + interval) % 12) as PitchClass;
                  return [...acc, next];
                },
                [mode.root],
              ).slice(0, 7);
              onSelectMode(pcs);
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded bg-gray-900 hover:bg-gray-700 transition-colors text-left"
          >
            <span className="text-white font-medium w-24 shrink-0">
              {NOTE_NAMES[mode.root]} {mode.name}
            </span>
            <BrightnessBar index={mode.brightnessIndex} />
            <span className="text-xs text-gray-400 w-8 text-right">
              {mode.brightnessIndex > 0 ? '+' : ''}{mode.brightnessIndex}
            </span>
            {mode.isPalindrome && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-900 text-indigo-300">
                palindrome
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

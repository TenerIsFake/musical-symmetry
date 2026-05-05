import { useState } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';

export interface HistoryEntry {
  id: number;
  chordName: string | null;
  noteNames: string;
  group: string;
  pcs: PitchClass[];
  timestamp: number;
}

interface Props {
  entries: HistoryEntry[];
  onRestore: (pcs: PitchClass[]) => void;
  onClear: () => void;
}

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function ChordHistory({ entries, onRestore, onClear }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between text-sm font-semibold text-gray-400 uppercase"
      >
        <span>
          History{' '}
          {entries.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs bg-gray-700 text-gray-300">
              {entries.length}
            </span>
          )}
        </span>
        <span className="text-gray-500">{collapsed ? '▸' : '▾'}</span>
      </button>
      {!collapsed && (
        <div className="mt-3 space-y-2">
          {entries.length === 0 && (
            <p className="text-xs text-gray-500">No chords classified yet.</p>
          )}
          {entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onRestore(entry.pcs)}
              className="w-full text-left bg-gray-900 rounded p-2 hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-white font-medium">
                  {entry.chordName ?? entry.noteNames}
                </span>
                <span className="text-xs text-gray-500">
                  {relativeTime(entry.timestamp)}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{entry.group}</div>
            </button>
          ))}
          {entries.length > 0 && (
            <button
              onClick={onClear}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-300 mt-2"
            >
              Clear History
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function buildHistoryEntry(
  pcs: PitchClass[],
  chordName: string | null,
  group: string,
): HistoryEntry {
  return {
    id: Date.now(),
    chordName,
    noteNames: pcs.map((pc) => NOTE_NAMES[pc]).join(', '),
    group,
    pcs: [...pcs],
    timestamp: Date.now(),
  };
}

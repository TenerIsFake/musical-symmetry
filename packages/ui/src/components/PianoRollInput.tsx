import { useState, useCallback } from 'react';
import { NOTE_NAMES } from '@musical-symmetry/core';

interface Note {
  pc: number;
  octave: number;
}

interface Props {
  notes: Note[];
  onNotesChange: (notes: Note[]) => void;
  maxNotes: number;
}

const OCTAVE_RANGE = [3, 4, 5] as const;
const SLOT_W = 28;
const ROW_H = 14;
const TOTAL_ROWS = OCTAVE_RANGE.length * 12;

export default function PianoRollInput({ notes, onNotesChange, maxNotes }: Props) {
  const [hoveredSlot, setHoveredSlot] = useState<{ col: number; row: number } | null>(null);

  const maxCols = Math.max(maxNotes, notes.length + 1);
  const cols = Math.min(maxCols, 32);
  const width = cols * SLOT_W + 40;
  const height = TOTAL_ROWS * ROW_H;

  const rowToNote = (row: number): Note => {
    const fromTop = TOTAL_ROWS - 1 - row;
    const octave = OCTAVE_RANGE[Math.floor(fromTop / 12)]!;
    const pc = fromTop % 12;
    return { pc, octave };
  };

  const noteToRow = (note: Note): number => {
    const octIdx = OCTAVE_RANGE.indexOf(note.octave as 3 | 4 | 5);
    if (octIdx === -1) return 0;
    const fromTop = octIdx * 12 + note.pc;
    return TOTAL_ROWS - 1 - fromTop;
  };

  const handleClick = useCallback((col: number, row: number) => {
    const existingIdx = notes.findIndex((_, i) => i === col);
    const note = rowToNote(row);

    if (col < notes.length) {
      const existing = notes[col]!;
      if (existing.pc === note.pc && existing.octave === note.octave) {
        onNotesChange(notes.filter((_, i) => i !== col));
      } else {
        const updated = [...notes];
        updated[col] = note;
        onNotesChange(updated);
      }
    } else if (notes.length < maxNotes) {
      onNotesChange([...notes, note]);
    }
  }, [notes, onNotesChange, maxNotes]);

  const isBlackKey = (pc: number) => [1, 3, 6, 8, 10].includes(pc);

  return (
    <div className="bg-gray-900 rounded-lg p-2 overflow-x-auto">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-400">
          {notes.length}/{maxNotes} notes
        </span>
        <button
          onClick={() => onNotesChange([])}
          className="text-xs px-2 py-0.5 bg-gray-700 rounded hover:bg-gray-600 text-gray-300"
        >
          Clear
        </button>
        <button
          onClick={() => {
            const count = Math.min(maxNotes, 8);
            const random: Note[] = Array.from({ length: count }, () => ({
              pc: Math.floor(Math.random() * 12),
              octave: OCTAVE_RANGE[Math.floor(Math.random() * 3)]!,
            }));
            onNotesChange(random);
          }}
          className="text-xs px-2 py-0.5 bg-gray-700 rounded hover:bg-gray-600 text-gray-300"
        >
          Random
        </button>
      </div>
      <div className="relative" style={{ width, height, minWidth: 200 }}>
        <svg width={width} height={height} className="absolute inset-0">
          {Array.from({ length: TOTAL_ROWS }, (_, row) => {
            const note = rowToNote(row);
            const black = isBlackKey(note.pc);
            return (
              <rect key={`bg-${row}`} x={40} y={row * ROW_H} width={width - 40} height={ROW_H}
                fill={black ? '#1e293b' : '#0f172a'} stroke="#374151" strokeWidth={0.5} />
            );
          })}
          {Array.from({ length: cols }, (_, col) =>
            Array.from({ length: TOTAL_ROWS }, (_, row) => (
              <rect
                key={`${col}-${row}`}
                x={40 + col * SLOT_W}
                y={row * ROW_H}
                width={SLOT_W}
                height={ROW_H}
                fill="transparent"
                stroke="#374151"
                strokeWidth={0.3}
                className="cursor-pointer hover:fill-indigo-900/30"
                onMouseEnter={() => setHoveredSlot({ col, row })}
                onMouseLeave={() => setHoveredSlot(null)}
                onClick={() => handleClick(col, row)}
              />
            ))
          )}
          {notes.map((note, col) => {
            const row = noteToRow(note);
            return (
              <rect
                key={`note-${col}`}
                x={40 + col * SLOT_W + 2}
                y={row * ROW_H + 1}
                width={SLOT_W - 4}
                height={ROW_H - 2}
                rx={3}
                fill="#6366f1"
                className="cursor-pointer"
                onClick={() => handleClick(col, row)}
              />
            );
          })}
          {hoveredSlot && (
            <rect
              x={40 + hoveredSlot.col * SLOT_W + 1}
              y={hoveredSlot.row * ROW_H + 1}
              width={SLOT_W - 2}
              height={ROW_H - 2}
              fill="#6366f1"
              opacity={0.3}
              rx={2}
              pointerEvents="none"
            />
          )}
        </svg>
        <div className="absolute left-0 top-0" style={{ width: 38, height }}>
          {Array.from({ length: TOTAL_ROWS }, (_, row) => {
            const note = rowToNote(row);
            if (note.pc === 0) {
              return (
                <div key={row} className="absolute text-[9px] text-gray-500 right-1" style={{ top: row * ROW_H }}>
                  C{note.octave}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}

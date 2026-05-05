import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';

interface Props {
  selectedPCs: PitchClass[];
  onToggle: (pc: PitchClass) => void;
}

const WHITE_KEYS: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];
const BLACK_KEYS: { pc: PitchClass; offset: number }[] = [
  { pc: 1, offset: 1 },
  { pc: 3, offset: 2 },
  { pc: 6, offset: 4 },
  { pc: 8, offset: 5 },
  { pc: 10, offset: 6 },
];

const WHITE_WIDTH = 40;
const WHITE_HEIGHT = 150;
const BLACK_WIDTH = 24;
const BLACK_HEIGHT = 95;
const TOTAL_WIDTH = WHITE_WIDTH * 7;

export default function PianoKeyboard({ selectedPCs, onToggle }: Props) {
  const isSelected = (pc: PitchClass) => selectedPCs.includes(pc);

  return (
    <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Tap notes to select</h2>
      <svg
        viewBox={`0 0 ${TOTAL_WIDTH} ${WHITE_HEIGHT}`}
        className="w-full cursor-pointer touch-manipulation"
        aria-label="Piano keyboard — tap to toggle pitch classes"
      >
        {WHITE_KEYS.map((pc, i) => (
          <rect
            key={`w-${pc}`}
            x={i * WHITE_WIDTH}
            y={0}
            width={WHITE_WIDTH - 2}
            height={WHITE_HEIGHT}
            rx={3}
            className={
              isSelected(pc)
                ? 'fill-green-500 stroke-green-700'
                : 'fill-white stroke-gray-300 hover:fill-gray-100'
            }
            strokeWidth={1}
            onClick={() => onToggle(pc)}
          />
        ))}
        {BLACK_KEYS.map(({ pc, offset }) => (
          <rect
            key={`b-${pc}`}
            x={offset * WHITE_WIDTH - BLACK_WIDTH / 2}
            y={0}
            width={BLACK_WIDTH}
            height={BLACK_HEIGHT}
            rx={2}
            className={
              isSelected(pc)
                ? 'fill-green-600 stroke-green-800'
                : 'fill-gray-900 stroke-gray-700 hover:fill-gray-800'
            }
            strokeWidth={1}
            onClick={() => onToggle(pc)}
          />
        ))}
        {WHITE_KEYS.map((pc, i) => (
          <text
            key={`label-${pc}`}
            x={i * WHITE_WIDTH + WHITE_WIDTH / 2 - 1}
            y={WHITE_HEIGHT - 10}
            textAnchor="middle"
            className="text-[9px] fill-gray-500 pointer-events-none select-none"
          >
            {NOTE_NAMES[pc]}
          </text>
        ))}
      </svg>
    </div>
  );
}

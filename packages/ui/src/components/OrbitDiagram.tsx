import type { PitchClass, SymmetryAnalysis } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';

interface Props {
  selectedPCs: PitchClass[];
  analysis: SymmetryAnalysis | null;
}

const CX = 150;
const CY = 150;
const RADIUS = 120;
const DOT_RADIUS = 14;

function pcToXY(pc: PitchClass, radius = RADIUS): [number, number] {
  const angle = (pc * 30 - 90) * (Math.PI / 180);
  return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)];
}

export default function OrbitDiagram({ selectedPCs, analysis }: Props) {
  const allPCs: PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  const axes: [number, number, number, number][] = [];
  if (analysis) {
    for (const axis of analysis.inversionalAxes) {
      const [x1, y1] = pcToXY(axis as PitchClass, RADIUS + 15);
      const opposite = ((axis + 6) % 12) as PitchClass;
      const [x2, y2] = pcToXY(opposite, RADIUS + 15);
      axes.push([x1, y1, x2, y2]);
    }
  }

  const polygonPoints = selectedPCs
    .map(pc => pcToXY(pc).join(','))
    .join(' ');

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Orbit Diagram</h2>
      <svg viewBox="0 0 300 300" className="w-full max-w-sm mx-auto">
        <circle cx={CX} cy={CY} r={RADIUS} fill="none" stroke="#374151" strokeWidth={1} />

        {axes.map(([x1, y1, x2, y2], i) => (
          <line
            key={`axis-${i}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#6366f1"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            opacity={0.6}
          />
        ))}

        {selectedPCs.length >= 3 && (
          <polygon
            points={polygonPoints}
            fill="rgba(34, 197, 94, 0.15)"
            stroke="#22c55e"
            strokeWidth={1.5}
          />
        )}

        {selectedPCs.length === 2 && (
          <line
            x1={pcToXY(selectedPCs[0]!)[0]}
            y1={pcToXY(selectedPCs[0]!)[1]}
            x2={pcToXY(selectedPCs[1]!)[0]}
            y2={pcToXY(selectedPCs[1]!)[1]}
            stroke="#22c55e"
            strokeWidth={1.5}
          />
        )}

        {allPCs.map(pc => {
          const [x, y] = pcToXY(pc);
          const isActive = selectedPCs.includes(pc);
          return (
            <g key={pc}>
              <circle
                cx={x}
                cy={y}
                r={DOT_RADIUS}
                fill={isActive ? '#22c55e' : '#1f2937'}
                stroke={isActive ? '#16a34a' : '#4b5563'}
                strokeWidth={1.5}
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                className="text-[10px] select-none pointer-events-none"
                fill={isActive ? '#fff' : '#9ca3af'}
              >
                {NOTE_NAMES[pc]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

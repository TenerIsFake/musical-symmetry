import type { CSEG } from '@musical-symmetry/core';

interface Props {
  cseg: CSEG;
  label?: string;
  highlightIndex?: number | null;
  width?: number;
  height?: number;
}

export default function ContourDiagram({ cseg, label, highlightIndex = null, width = 320, height = 160 }: Props) {
  if (cseg.length === 0) return null;

  const padding = 24;
  const plotW = width - padding * 2;
  const plotH = height - padding * 2;
  const max = Math.max(...cseg);
  const n = cseg.length;

  const points = cseg.map((v, i) => ({
    x: padding + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW),
    y: padding + (max === 0 ? plotH / 2 : plotH - (v / max) * plotH),
  }));

  const segments: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const color = p2.y < p1.y ? '#22c55e' : p2.y > p1.y ? '#ef4444' : '#6b7280';
    segments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, color });
  }

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      {label && <p className="text-xs text-gray-400 mb-1">{label}</p>}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
        {segments.map((s, i) => (
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={2.5} strokeLinecap="round" />
        ))}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={highlightIndex === i ? 7 : 5} fill={highlightIndex === i ? '#f59e0b' : '#e2e8f0'} stroke="#1f2937" strokeWidth={1.5} />
            <text x={p.x} y={p.y + 18} textAnchor="middle" fontSize="10" fill="#9ca3af">{cseg[i]}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

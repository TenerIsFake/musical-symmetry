import { useState, useCallback } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { classify, NOTE_NAMES } from '@musical-symmetry/core';

interface Props {
  initialPcs: PitchClass[];
  style: 'orbit' | 'keyboard';
  interactive: boolean;
  showWatermark: boolean;
}

const CX = 100, CY = 100, R = 75;
const ALL_PCS: PitchClass[] = [0,1,2,3,4,5,6,7,8,9,10,11];

function pcToXY(pc: PitchClass, radius = R): [number, number] {
  const angle = (pc * 30 - 90) * (Math.PI / 180);
  return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)];
}

export default function EmbedWidget({ initialPcs, style, interactive, showWatermark }: Props) {
  const [pcs, setPcs] = useState<PitchClass[]>(initialPcs);
  const analysis = pcs.length >= 2 ? classify(pcs) : null;

  const toggle = useCallback((pc: PitchClass) => {
    if (!interactive) return;
    setPcs(prev =>
      prev.includes(pc) ? prev.filter(p => p !== pc) : [...prev, pc].sort((a, b) => a - b)
    );
  }, [interactive]);

  const polygon = pcs.length >= 3
    ? pcs.map(pc => pcToXY(pc).join(',')).join(' ')
    : '';

  return (
    <div style={{ width: '100%', maxWidth: 300, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      {style === 'orbit' && (
        <svg viewBox="0 0 200 200" style={{ width: '100%' }}>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#374151" strokeWidth={1} />
          {polygon && (
            <polygon points={polygon} fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth={1.5} />
          )}
          {ALL_PCS.map(pc => {
            const [x, y] = pcToXY(pc);
            const active = pcs.includes(pc);
            return (
              <g key={pc} onClick={() => toggle(pc)} style={{ cursor: interactive ? 'pointer' : 'default' }}>
                <circle cx={x} cy={y} r={active ? 12 : 10} fill={active ? '#22c55e' : '#1f2937'} stroke={active ? '#16a34a' : '#4b5563'} strokeWidth={1.5} />
                <text x={x} y={y + 3.5} textAnchor="middle" fontSize={8} fill={active ? '#fff' : '#9ca3af'}>{NOTE_NAMES[pc]}</text>
              </g>
            );
          })}
        </svg>
      )}
      {analysis && (
        <div style={{ textAlign: 'center', padding: '4px 0', fontSize: 12, color: '#9ca3af' }}>
          <strong style={{ color: '#fff' }}>{analysis.abstractGroup}</strong>
          {` | IV: [${analysis.intervalVector.join(', ')}]`}
        </div>
      )}
      {showWatermark && (
        <div style={{ textAlign: 'center', fontSize: 10, color: '#4b5563', padding: '2px 0' }}>
          <a href="https://symmetry.tendrid.us" target="_blank" rel="noopener" style={{ color: '#6366f1', textDecoration: 'none' }}>
            Musical Symmetry
          </a>
        </div>
      )}
    </div>
  );
}

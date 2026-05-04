import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { Chord, PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';

interface Props {
  chord: Chord | null;
  targetChord: Chord | null;
}

interface TonnetzNode {
  pc: PitchClass;
  x: number;
  y: number;
}

function generateGrid(cols: number, rows: number): TonnetzNode[] {
  const nodes: TonnetzNode[] = [];
  const spacing = 60;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const pc = ((col * 7 + row * 4) % 12) as PitchClass;
      const x = col * spacing + (row % 2) * (spacing / 2);
      const y = row * spacing * 0.866;
      nodes.push({ pc, x, y });
    }
  }
  return nodes;
}

function findTriangles(nodes: TonnetzNode[], chord: Chord): [TonnetzNode, TonnetzNode, TonnetzNode][] {
  const [p0, p1, p2] = chord.pitchClasses;
  const results: [TonnetzNode, TonnetzNode, TonnetzNode][] = [];

  for (const n0 of nodes.filter(n => n.pc === p0)) {
    for (const n1 of nodes.filter(n => n.pc === p1)) {
      const dist01 = Math.hypot(n1.x - n0.x, n1.y - n0.y);
      if (dist01 > 80) continue;
      for (const n2 of nodes.filter(n => n.pc === p2)) {
        const dist02 = Math.hypot(n2.x - n0.x, n2.y - n0.y);
        const dist12 = Math.hypot(n2.x - n1.x, n2.y - n1.y);
        if (dist02 < 80 && dist12 < 80) {
          results.push([n0, n1, n2]);
        }
      }
    }
  }
  return results;
}

export default function TonnetzViz({ chord, targetChord }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const COLS = 8;
  const ROWS = 5;

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 500;
    const height = 280;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', 'translate(20, 20)');

    try {
      if (typeof window !== 'undefined' && window.SVGElement) {
        const zoom = d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.5, 3])
          .on('zoom', (event) => {
            g.attr('transform', event.transform.toString());
          });
        svg.call(zoom);
      }
    } catch (_e) {
      // zoom not available in test environment
    }

    const nodes = generateGrid(COLS, ROWS);

    // Draw edges between nearby nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = Math.hypot(nodes[j]!.x - nodes[i]!.x, nodes[j]!.y - nodes[i]!.y);
        if (dist < 70) {
          g.append('line')
            .attr('x1', nodes[i]!.x).attr('y1', nodes[i]!.y)
            .attr('x2', nodes[j]!.x).attr('y2', nodes[j]!.y)
            .attr('stroke', '#374151')
            .attr('stroke-width', 0.5);
        }
      }
    }

    // Highlight chord triangles
    if (chord) {
      const triangles = findTriangles(nodes, chord);
      for (const [a, b, c] of triangles) {
        g.append('polygon')
          .attr('points', `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`)
          .attr('fill', 'rgba(34, 197, 94, 0.3)')
          .attr('stroke', '#22c55e')
          .attr('stroke-width', 1.5);
      }
    }

    // Highlight target chord
    if (targetChord) {
      const triangles = findTriangles(nodes, targetChord);
      for (const [a, b, c] of triangles) {
        g.append('polygon')
          .attr('points', `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`)
          .attr('fill', 'rgba(234, 179, 8, 0.25)')
          .attr('stroke', '#eab308')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '3 2');
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const isInChord = chord?.pitchClasses.includes(node.pc);
      g.append('circle')
        .attr('cx', node.x)
        .attr('cy', node.y)
        .attr('r', 12)
        .attr('fill', isInChord ? '#22c55e' : '#1f2937')
        .attr('stroke', isInChord ? '#16a34a' : '#4b5563')
        .attr('stroke-width', 1);

      g.append('text')
        .attr('x', node.x)
        .attr('y', node.y + 3.5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '9px')
        .attr('fill', isInChord ? '#fff' : '#9ca3af')
        .text(NOTE_NAMES[node.pc]);
    }
  }, [chord, targetChord]);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Tonnetz</h2>
      <svg ref={svgRef} className="w-full" style={{ minHeight: '240px' }} />
    </div>
  );
}

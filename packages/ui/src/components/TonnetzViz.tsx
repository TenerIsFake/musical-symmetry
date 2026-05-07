import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { Chord, PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES, applyP, applyL, applyR } from '@musical-symmetry/core';
import { useUser } from '../context/UserContext';

interface Props {
  chord: Chord | null;
  targetChord: Chord | null;
  onChordChange?: (chord: Chord) => void;
}

interface TonnetzNode {
  pc: PitchClass;
  x: number;
  y: number;
  col: number;
  row: number;
}

const SPACING = 60;
const COLS = 9;
const ROWS = 6;

function generateGrid(cols: number, rows: number): TonnetzNode[] {
  const nodes: TonnetzNode[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const pc = ((col * 7 + row * 4) % 12) as PitchClass;
      const x = col * SPACING + (row % 2) * (SPACING / 2);
      const y = row * SPACING * 0.866;
      nodes.push({ pc, x, y, col, row });
    }
  }
  return nodes;
}

function findTriangles(nodes: TonnetzNode[], pcs: PitchClass[]): [TonnetzNode, TonnetzNode, TonnetzNode][] {
  if (pcs.length < 3) return [];
  const [p0, p1, p2] = pcs;
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

// Find centroid of triangle
function centroid(a: TonnetzNode, b: TonnetzNode, c: TonnetzNode) {
  return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
}

// Arrow midpoint between two centroids
function midpoint(ax: number, ay: number, bx: number, by: number) {
  return { x: (ax + bx) / 2, y: (ay + by) / 2 };
}

interface PLRNeighbor {
  label: 'P' | 'L' | 'R';
  chord: Chord;
  color: string;
}

const PLR_COLORS = { P: '#f472b6', L: '#60a5fa', R: '#fb923c' };

export default function TonnetzViz({ chord, targetChord, onChordChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { user } = useUser();
  const isPro = user?.tier === 'pro' || user?.tier === 'research';
  const isResearch = user?.tier === 'research';

  // Animated transition state: prev pcs fading out, next pcs fading in
  const [displayChord, setDisplayChord] = useState<Chord | null>(chord);
  const [animating, setAnimating] = useState(false);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When chord prop changes, animate
  useEffect(() => {
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    setAnimating(true);
    animTimerRef.current = setTimeout(() => {
      setDisplayChord(chord);
      setAnimating(false);
    }, 180);
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, [chord]);

  const handlePLR = useCallback((label: 'P' | 'L' | 'R') => {
    if (!displayChord || !onChordChange || !isPro) return;
    const fn = label === 'P' ? applyP : label === 'L' ? applyL : applyR;
    onChordChange(fn(displayChord));
  }, [displayChord, onChordChange, isPro]);

  const handleNodeClick = useCallback((pc: PitchClass) => {
    if (!isPro || !onChordChange) return;
    // Build a major chord rooted on this pc
    const newChord: Chord = {
      root: pc,
      quality: 'major',
      pitchClasses: [pc, ((pc + 4) % 12) as PitchClass, ((pc + 7) % 12) as PitchClass],
    };
    onChordChange(newChord);
  }, [isPro, onChordChange]);

  // Export SVG
  const handleExport = useCallback(() => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgRef.current);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tonnetz.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 560;
    const height = 320;
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

    // Determine highlighted PCs
    const activePcs: Set<PitchClass> = new Set(
      displayChord?.pitchClasses ?? []
    );
    const targetPcs: Set<PitchClass> = new Set(
      targetChord?.pitchClasses ?? []
    );

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

    // Highlight chord triangles (current)
    if (displayChord) {
      const triangles = findTriangles(nodes, displayChord.pitchClasses as PitchClass[]);
      for (const [a, b, c] of triangles) {
        g.append('polygon')
          .attr('points', `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`)
          .attr('fill', animating ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.3)')
          .attr('stroke', '#22c55e')
          .attr('stroke-width', animating ? 0.5 : 1.5)
          .style('transition', 'all 0.18s ease');
      }
    }

    // Highlight target chord
    if (targetChord) {
      const triangles = findTriangles(nodes, targetChord.pitchClasses as PitchClass[]);
      for (const [a, b, c] of triangles) {
        g.append('polygon')
          .attr('points', `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`)
          .attr('fill', 'rgba(234, 179, 8, 0.25)')
          .attr('stroke', '#eab308')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '3 2');
      }
    }

    // Draw PLR neighbor arrows when chord is present and interactive
    if (displayChord && isPro) {
      const neighbors: PLRNeighbor[] = [
        { label: 'P', chord: applyP(displayChord), color: PLR_COLORS.P },
        { label: 'L', chord: applyL(displayChord), color: PLR_COLORS.L },
        { label: 'R', chord: applyR(displayChord), color: PLR_COLORS.R },
      ];

      const srcTriangles = findTriangles(nodes, displayChord.pitchClasses as PitchClass[]);
      if (srcTriangles.length > 0) {
        const srcTri = srcTriangles[0]!;
        const srcCenter = centroid(srcTri[0], srcTri[1], srcTri[2]);

        for (const neighbor of neighbors) {
          const dstTriangles = findTriangles(nodes, neighbor.chord.pitchClasses as PitchClass[]);
          if (dstTriangles.length === 0) continue;
          const dstTri = dstTriangles[0]!;
          const dstCenter = centroid(dstTri[0], dstTri[1], dstTri[2]);
          const mid = midpoint(srcCenter.x, srcCenter.y, dstCenter.x, dstCenter.y);

          // Arrow line
          g.append('line')
            .attr('x1', srcCenter.x).attr('y1', srcCenter.y)
            .attr('x2', dstCenter.x).attr('y2', dstCenter.y)
            .attr('stroke', neighbor.color)
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '4 2')
            .attr('opacity', 0.8);

          // Label at midpoint — clickable
          const labelGroup = g.append('g')
            .attr('transform', `translate(${mid.x}, ${mid.y})`)
            .attr('cursor', onChordChange ? 'pointer' : 'default')
            .on('click', () => handlePLR(neighbor.label));

          labelGroup.append('rect')
            .attr('x', -9).attr('y', -9)
            .attr('width', 18).attr('height', 14)
            .attr('rx', 3)
            .attr('fill', neighbor.color)
            .attr('opacity', 0.9);

          labelGroup.append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('y', -2)
            .attr('font-size', '9px')
            .attr('font-weight', 'bold')
            .attr('fill', '#111')
            .text(neighbor.label);
        }
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const isInChord = activePcs.has(node.pc);
      const isInTarget = targetPcs.has(node.pc);
      const isClickable = isPro && !!onChordChange;

      const circle = g.append('circle')
        .attr('cx', node.x)
        .attr('cy', node.y)
        .attr('r', isInChord ? 14 : 12)
        .attr('fill', isInChord
          ? (animating ? 'rgba(34, 197, 94, 0.5)' : '#22c55e')
          : isInTarget ? '#854d0e' : '#1f2937')
        .attr('stroke', isInChord ? '#16a34a' : isInTarget ? '#eab308' : '#4b5563')
        .attr('stroke-width', isInChord || isInTarget ? 2 : 1)
        .style('transition', 'all 0.18s ease');

      if (isClickable) {
        circle
          .attr('cursor', 'pointer')
          .on('click', () => handleNodeClick(node.pc))
          .on('mouseenter', function() {
            d3.select(this).attr('stroke', '#a5b4fc').attr('stroke-width', 2);
          })
          .on('mouseleave', function() {
            d3.select(this)
              .attr('stroke', isInChord ? '#16a34a' : isInTarget ? '#eab308' : '#4b5563')
              .attr('stroke-width', isInChord || isInTarget ? 2 : 1);
          });
      }

      g.append('text')
        .attr('x', node.x)
        .attr('y', node.y + 3.5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '9px')
        .attr('fill', isInChord ? '#fff' : isInTarget ? '#fde68a' : '#9ca3af')
        .attr('pointer-events', 'none')
        .text(NOTE_NAMES[node.pc]);
    }
  }, [displayChord, targetChord, animating, isPro, handlePLR, handleNodeClick, onChordChange]);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase">Tonnetz</h2>
        <div className="flex items-center gap-2">
          {isPro && (
            <div className="flex gap-2 text-xs">
              {(['P', 'L', 'R'] as const).map(label => (
                <button
                  key={label}
                  onClick={() => handlePLR(label)}
                  disabled={!displayChord || !onChordChange}
                  className="px-2 py-0.5 rounded font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  style={{ backgroundColor: PLR_COLORS[label], color: '#111' }}
                  title={`Apply ${label} transform`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {isResearch && (
            <button
              onClick={handleExport}
              className="text-xs px-2 py-0.5 rounded bg-purple-700 text-white hover:bg-purple-600 transition-colors"
              title="Export as SVG"
            >
              Export SVG
            </button>
          )}
          {!isPro && (
            <span className="text-xs text-gray-500 italic">Pro: interactive transforms</span>
          )}
        </div>
      </div>
      <svg ref={svgRef} className="w-full" style={{ minHeight: '260px' }} />
      {isPro && onChordChange && (
        <p className="text-xs text-gray-500 mt-1">
          Click P/L/R buttons or labels to apply transforms · Click a hex to root a major chord
        </p>
      )}
    </div>
  );
}

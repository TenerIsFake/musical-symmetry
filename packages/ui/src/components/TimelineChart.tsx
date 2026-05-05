import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface SliceData {
  startBeat: number;
  endBeat: number;
  abstractGroup: string;
  mullikenLabel: string;
  stabilizerOrder: number;
  chordName: string | null;
}

interface Props {
  slices: SliceData[];
  onSelectSlice: (index: number) => void;
  selectedIndex: number | null;
}

const GROUP_COLORS: Record<string, string> = {
  C1: '#6b7280',
  Z2: '#8b5cf6',
  C2: '#3b82f6',
  C3: '#06b6d4',
  C4: '#10b981',
  C6: '#22c55e',
  D2: '#eab308',
  D3: '#f97316',
  D4: '#ef4444',
  D6: '#dc2626',
  D12: '#ec4899',
};

export default function TimelineChart({ slices, onSelectSlice, selectedIndex }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || slices.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 700;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear()
      .domain([slices[0]!.startBeat, slices[slices.length - 1]!.endBeat])
      .range([0, innerW]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(slices, d => d.stabilizerOrder) ?? 6])
      .range([innerH, 0]);

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(10))
      .selectAll('text').attr('fill', '#9ca3af').attr('font-size', '10px');

    g.append('text')
      .attr('x', innerW / 2).attr('y', innerH + 35)
      .attr('text-anchor', 'middle').attr('fill', '#6b7280').attr('font-size', '11px')
      .text('Beat');

    // Y axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4))
      .selectAll('text').attr('fill', '#9ca3af').attr('font-size', '10px');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -35)
      .attr('text-anchor', 'middle').attr('fill', '#6b7280').attr('font-size', '11px')
      .text('Stabilizer Order');

    // Bars
    g.selectAll('rect.bar')
      .data(slices)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.startBeat))
      .attr('y', d => yScale(d.stabilizerOrder))
      .attr('width', d => Math.max(1, xScale(d.endBeat) - xScale(d.startBeat) - 1))
      .attr('height', d => innerH - yScale(d.stabilizerOrder))
      .attr('fill', d => GROUP_COLORS[d.abstractGroup] ?? '#6b7280')
      .attr('opacity', (_, i) => i === selectedIndex ? 1 : 0.7)
      .attr('stroke', (_, i) => i === selectedIndex ? '#fff' : 'none')
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer')
      .on('click', (_, d) => {
        const idx = slices.indexOf(d);
        onSelectSlice(idx);
      });

    // Group labels on bars (if wide enough)
    const barWidth = innerW / slices.length;
    if (barWidth > 25) {
      g.selectAll('text.label')
        .data(slices)
        .join('text')
        .attr('class', 'label')
        .attr('x', d => xScale(d.startBeat) + (xScale(d.endBeat) - xScale(d.startBeat)) / 2)
        .attr('y', d => yScale(d.stabilizerOrder) - 4)
        .attr('text-anchor', 'middle')
        .attr('fill', '#e5e7eb')
        .attr('font-size', '8px')
        .text(d => d.abstractGroup);
    }
  }, [slices, selectedIndex, onSelectSlice]);

  return <svg ref={svgRef} className="w-full" style={{ minHeight: '200px' }} />;
}

export type { SliceData };

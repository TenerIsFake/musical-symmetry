import { useState, useEffect, useRef, useCallback } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES, voiceLeadingDistance } from '@musical-symmetry/core';
import { playPitchClasses } from '../utils/audio';
import { useUser } from '../context/UserContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChordDef {
  id: string;
  root: number;
  quality: string;
  templateName: string;
  pcs: number[];
}

interface GraphNode extends ChordDef {
  x: number;
  y: number;
  vx: number;
  vy: number;
  degree: number;
}

interface GraphEdge {
  source: string;
  target: string;
  distance: number;
}

interface VoiceDetail {
  from: number;
  to: number;
  movement: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// 12-color palette — one per pitch class (root)
const PC_COLORS: string[] = [
  '#ef4444', // C  — red
  '#f97316', // C♯ — orange
  '#f59e0b', // D  — amber
  '#eab308', // E♭ — yellow
  '#84cc16', // E  — lime
  '#22c55e', // F  — green
  '#10b981', // F♯ — emerald
  '#06b6d4', // G  — cyan
  '#3b82f6', // A♭ — blue
  '#6366f1', // A  — indigo
  '#a855f7', // B♭ — purple
  '#ec4899', // B  — pink
];

const TRIAD_TEMPLATES = [
  { name: 'major',      label: '',    intervals: [0, 4, 7] },
  { name: 'minor',      label: 'm',   intervals: [0, 3, 7] },
  { name: 'diminished', label: 'dim', intervals: [0, 3, 6] },
  { name: 'augmented',  label: 'aug', intervals: [0, 4, 8] },
];

const SEVENTH_TEMPLATES = [
  { name: 'maj7',  label: 'maj7', intervals: [0, 4, 7, 11] },
  { name: 'dom7',  label: '7',    intervals: [0, 4, 7, 10] },
  { name: 'min7',  label: 'm7',   intervals: [0, 3, 7, 10] },
  { name: 'dim7',  label: 'dim7', intervals: [0, 3, 6, 9] },
  { name: 'min7b5',label: 'ø7',   intervals: [0, 3, 6, 10] },
];

const SUS_TEMPLATES = [
  { name: 'sus2', label: 'sus2', intervals: [0, 2, 7] },
  { name: 'sus4', label: 'sus4', intervals: [0, 5, 7] },
];

// Circle of fifths ordering: C G D A E B F♯ D♭ A♭ E♭ B♭ F
const CIRCLE_OF_FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

// ─── Chord vocabulary ─────────────────────────────────────────────────────────

function buildChordVocab(
  includeSevenths: boolean,
  includeSus: boolean,
  rootFilter: Set<number>
): ChordDef[] {
  const templates = [
    ...TRIAD_TEMPLATES,
    ...(includeSevenths ? SEVENTH_TEMPLATES : []),
    ...(includeSus ? SUS_TEMPLATES : []),
  ];

  const chords: ChordDef[] = [];
  for (let root = 0; root < 12; root++) {
    if (rootFilter.size > 0 && !rootFilter.has(root)) continue;
    for (const tmpl of templates) {
      const pcs = tmpl.intervals.map(i => (i + root) % 12);
      const noteName = NOTE_NAMES[root as PitchClass];
      const id = `${root}-${tmpl.name}`;
      chords.push({
        id,
        root,
        quality: tmpl.name,
        templateName: `${noteName}${tmpl.label}`,
        pcs,
      });
    }
  }
  return chords;
}

// ─── Voice-leading detail ──────────────────────────────────────────────────────

function computeVoiceDetails(a: number[], b: number[]): VoiceDetail[] {
  if (a.length !== b.length) return [];
  // find best permutation of b that minimises total movement
  function permutations<T>(arr: T[]): T[][] {
    if (arr.length <= 1) return [arr];
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const perm of permutations(rest)) result.push([arr[i]!, ...perm]);
    }
    return result;
  }
  function semDist(x: number, y: number) { const d = Math.abs(x - y); return Math.min(d, 12 - d); }

  let bestPerm = b;
  let bestTotal = Infinity;
  for (const perm of permutations(b)) {
    const total = a.reduce((s, n, i) => s + semDist(n, perm[i]!), 0);
    if (total < bestTotal) { bestTotal = total; bestPerm = perm; }
  }
  return a.map((from, i) => ({
    from,
    to: bestPerm[i]!,
    movement: semDist(from, bestPerm[i]!),
  }));
}

// ─── Force simulation ─────────────────────────────────────────────────────────

const SIM_WIDTH = 800;
const SIM_HEIGHT = 600;
const ITERATIONS = 180;
const IDEAL_EDGE_LEN = 90;
const REPULSION = 2500;
const SPRING_K = 0.08;
const DAMPING = 0.82;
const BORDER_PAD = 40;

function runForceSimulation(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  const ns = nodes.map(n => ({ ...n }));

  for (let iter = 0; iter < ITERATIONS; iter++) {
    // repulsion between all pairs
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const dx = ns[j]!.x - ns[i]!.x;
        const dy = ns[j]!.y - ns[i]!.y;
        const dist2 = dx * dx + dy * dy + 1;
        const dist = Math.sqrt(dist2);
        const force = REPULSION / dist2;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        ns[i]!.vx -= fx;
        ns[i]!.vy -= fy;
        ns[j]!.vx += fx;
        ns[j]!.vy += fy;
      }
    }

    // spring attraction along edges
    const nodeMap = new Map(ns.map(n => [n.id, n]));
    for (const edge of edges) {
      const s = nodeMap.get(edge.source);
      const t = nodeMap.get(edge.target);
      if (!s || !t) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
      const stretch = dist - IDEAL_EDGE_LEN;
      const force = SPRING_K * stretch;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.vx += fx; s.vy += fy;
      t.vx -= fx; t.vy -= fy;
    }

    // center gravity (weak pull toward center)
    const cx = SIM_WIDTH / 2;
    const cy = SIM_HEIGHT / 2;
    for (const n of ns) {
      n.vx += (cx - n.x) * 0.002;
      n.vy += (cy - n.y) * 0.002;
    }

    // integrate + dampen
    for (const n of ns) {
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x += n.vx;
      n.y += n.vy;
      // clamp to bounds
      n.x = Math.max(BORDER_PAD, Math.min(SIM_WIDTH - BORDER_PAD, n.x));
      n.y = Math.max(BORDER_PAD, Math.min(SIM_HEIGHT - BORDER_PAD, n.y));
    }
  }

  return ns;
}

function circleOfFifthsLayout(nodes: GraphNode[]): GraphNode[] {
  // Group by root, arrange roots in CoF order on a large circle, then quality on inner rings
  const qualityOrder = ['major', 'minor', 'diminished', 'augmented', 'dom7', 'maj7', 'min7', 'dim7', 'min7b5', 'sus2', 'sus4'];

  // Group nodes by root
  const byRoot = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    if (!byRoot.has(n.root)) byRoot.set(n.root, []);
    byRoot.get(n.root)!.push(n);
  }

  const cx = SIM_WIDTH / 2;
  const cy = SIM_HEIGHT / 2;
  const rootRadius = 220;
  const qualitySpread = 28;

  const result = nodes.map(n => ({ ...n }));
  const resultMap = new Map(result.map(n => [n.id, n]));

  // Only use roots that are actually present
  const presentRoots = CIRCLE_OF_FIFTHS.filter(r => byRoot.has(r));
  const angleStep = (2 * Math.PI) / presentRoots.length;

  presentRoots.forEach((root, rootIdx) => {
    const angle = rootIdx * angleStep - Math.PI / 2;
    const rootX = cx + rootRadius * Math.cos(angle);
    const rootY = cy + rootRadius * Math.sin(angle);

    const nodesForRoot = byRoot.get(root) ?? [];
    nodesForRoot.sort((a, b) => qualityOrder.indexOf(a.quality) - qualityOrder.indexOf(b.quality));

    nodesForRoot.forEach((node, qi) => {
      const spread = (qi - (nodesForRoot.length - 1) / 2) * qualitySpread;
      const perpAngle = angle + Math.PI / 2;
      const n = resultMap.get(node.id)!;
      n.x = rootX + Math.cos(perpAngle) * spread;
      n.y = rootY + Math.sin(perpAngle) * spread;
      n.vx = 0;
      n.vy = 0;
    });
  });

  return result;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VoiceLeadingGraphPage() {
  const { user } = useUser();
  const isPro = user?.tier === 'pro' || user?.tier === 'research';

  // Controls
  const [includeSevenths, setIncludeSevenths] = useState(false);
  const [includeSus, setIncludeSus] = useState(false);
  const [maxDistance, setMaxDistance] = useState(2);
  const [rootFilter, setRootFilter] = useState<Set<number>>(new Set());
  const [layout, setLayout] = useState<'force' | 'cof'>('force');

  // Graph state
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Interaction
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ source: string; target: string } | null>(null);
  const [voiceDetails, setVoiceDetails] = useState<VoiceDetail[] | null>(null);
  const [sidePanelChord, setSidePanelChord] = useState<ChordDef | null>(null);
  const [neighborIds, setNeighborIds] = useState<Set<string>>(new Set());

  // Drag state
  const draggingNodeRef = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Build and simulate graph
  useEffect(() => {
    setIsSimulating(true);
    setSelectedNode(null);
    setSidePanelChord(null);
    setVoiceDetails(null);
    setNeighborIds(new Set());

    const effectiveSevenths = isPro ? includeSevenths : false;
    const effectiveSus = includeSus;

    const chords = buildChordVocab(effectiveSevenths, effectiveSus, rootFilter);

    // Build edges
    const edgeList: GraphEdge[] = [];
    for (let i = 0; i < chords.length; i++) {
      for (let j = i + 1; j < chords.length; j++) {
        const a = chords[i]!;
        const b = chords[j]!;
        if (a.pcs.length !== b.pcs.length) continue;
        const dist = voiceLeadingDistance(a.pcs as PitchClass[], b.pcs as PitchClass[]);
        if (dist > 0 && dist <= maxDistance) {
          edgeList.push({ source: a.id, target: b.id, distance: dist });
        }
      }
    }

    // Build degree map
    const degreeMap = new Map<string, number>();
    for (const e of edgeList) {
      degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
      degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
    }

    // Initialize node positions randomly
    const initialNodes: GraphNode[] = chords.map(c => ({
      ...c,
      x: BORDER_PAD + Math.random() * (SIM_WIDTH - 2 * BORDER_PAD),
      y: BORDER_PAD + Math.random() * (SIM_HEIGHT - 2 * BORDER_PAD),
      vx: 0,
      vy: 0,
      degree: degreeMap.get(c.id) ?? 0,
    }));

    // Run simulation in a timeout to avoid blocking
    setTimeout(() => {
      let result: GraphNode[];
      if (layout === 'force') {
        result = runForceSimulation(initialNodes, edgeList);
      } else {
        result = circleOfFifthsLayout(initialNodes);
      }
      setNodes(result);
      setEdges(edgeList);
      setIsSimulating(false);
    }, 0);
  }, [includeSevenths, includeSus, maxDistance, rootFilter, layout, isPro]);

  // Node click handler
  const handleNodeClick = useCallback((node: GraphNode) => {
    if (selectedNode === node.id) {
      setSelectedNode(null);
      setSidePanelChord(null);
      setVoiceDetails(null);
      setNeighborIds(new Set());
      return;
    }

    setSelectedNode(node.id);
    setSidePanelChord(node);
    setVoiceDetails(null);

    // compute neighbors
    const nbrs = new Set<string>();
    for (const e of edges) {
      if (e.source === node.id) nbrs.add(e.target);
      if (e.target === node.id) nbrs.add(e.source);
    }
    setNeighborIds(nbrs);

    // play chord
    playPitchClasses(node.pcs as PitchClass[], 'chord', 1.5);
  }, [selectedNode, edges]);

  // Edge click handler
  const handleEdgeClick = useCallback((edge: GraphEdge) => {
    const srcNode = nodes.find(n => n.id === edge.source);
    const tgtNode = nodes.find(n => n.id === edge.target);
    if (!srcNode || !tgtNode) return;

    const details = computeVoiceDetails(srcNode.pcs, tgtNode.pcs);
    setSelectedNode(null);
    setSidePanelChord(srcNode);
    setVoiceDetails(details);
    setNeighborIds(new Set([srcNode.id, tgtNode.id]));

    // play both chords in sequence
    const ctx = new AudioContext();
    const baseFreq = 261.63;
    const playChord = (pcs: number[], startTime: number) => {
      pcs.forEach(pc => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = baseFreq * Math.pow(2, pc / 12);
        gain.gain.value = 0.3 / pcs.length;
        osc.connect(gain).connect(ctx.destination);
        osc.start(startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.4);
        osc.stop(startTime + 1.5);
      });
    };
    playChord(srcNode.pcs, ctx.currentTime);
    playChord(tgtNode.pcs, ctx.currentTime + 1.6);
  }, [nodes]);

  // Drag handling
  const svgPoint = useCallback((e: React.MouseEvent<SVGSVGElement>): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = SIM_WIDTH / rect.width;
    const scaleY = SIM_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    draggingNodeRef.current = nodeId;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingNodeRef.current) return;
    const { x, y } = svgPoint(e);
    setNodes(prev => prev.map(n =>
      n.id === draggingNodeRef.current
        ? { ...n, x: Math.max(BORDER_PAD, Math.min(SIM_WIDTH - BORDER_PAD, x)), y: Math.max(BORDER_PAD, Math.min(SIM_HEIGHT - BORDER_PAD, y)), vx: 0, vy: 0 }
        : n
    ));
  }, [svgPoint]);

  const handleMouseUp = useCallback(() => {
    draggingNodeRef.current = null;
  }, []);

  // Toggle root filter
  const toggleRoot = (pc: number) => {
    setRootFilter(prev => {
      const next = new Set(prev);
      if (next.has(pc)) next.delete(pc); else next.add(pc);
      return next;
    });
  };

  // SVG export (Pro only)
  const exportSvg = () => {
    if (!isPro) return;
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const str = serializer.serializeToString(svg);
    const blob = new Blob([str], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'voice-leading-graph.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Derived rendering values
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const maxDegree = Math.max(1, ...nodes.map(n => n.degree));

  function nodeRadius(n: GraphNode): number {
    const base = 10;
    const extra = 8;
    return base + extra * (n.degree / maxDegree);
  }

  function edgeOpacity(e: GraphEdge): number {
    // Distance 1 = bright, distance maxDistance = dim
    return 0.15 + 0.5 * (1 - (e.distance - 1) / Math.max(1, maxDistance - 1));
  }

  function edgeColor(e: GraphEdge): string {
    const t = (e.distance - 1) / Math.max(1, maxDistance - 1);
    // green (close) to red (far)
    const r = Math.round(34 + 200 * t);
    const g = Math.round(197 - 160 * t);
    const b = Math.round(94 - 60 * t);
    return `rgb(${r},${g},${b})`;
  }

  const isNodeDimmed = (id: string) =>
    selectedNode !== null && id !== selectedNode && !neighborIds.has(id);

  const isEdgeDimmed = (e: GraphEdge) =>
    selectedNode !== null && e.source !== selectedNode && e.target !== selectedNode;

  return (
    <div className="space-y-4">
      {/* ── Controls ── */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase">Controls</h2>

        <div className="flex flex-wrap gap-4 items-center">
          {/* Chord type filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium uppercase">Chord types:</span>
            <button
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                !includeSevenths && !includeSus
                  ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => { setIncludeSevenths(false); setIncludeSus(false); }}
            >
              Triads only
            </button>
            <button
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                !isPro ? 'opacity-50 cursor-not-allowed bg-gray-700 text-gray-500' :
                includeSevenths
                  ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => { if (isPro) setIncludeSevenths(v => !v); }}
              title={!isPro ? 'Pro tier required for 7th chords' : undefined}
            >
              + 7ths {!isPro && <span className="text-yellow-500 ml-1">Pro</span>}
            </button>
            <button
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                includeSus
                  ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => setIncludeSus(v => !v)}
            >
              + Sus
            </button>
          </div>

          {/* Max distance slider */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 font-medium uppercase whitespace-nowrap">
              Max distance: <span className="text-white font-semibold">{maxDistance}</span>
            </label>
            <input
              type="range" min={1} max={6} value={maxDistance}
              onChange={e => setMaxDistance(Number(e.target.value))}
              className="w-28 accent-indigo-500"
            />
          </div>

          {/* Layout toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium uppercase">Layout:</span>
            <button
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                layout === 'force' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => setLayout('force')}
            >
              Force-directed
            </button>
            <button
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                layout === 'cof' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => setLayout('cof')}
            >
              Circle of fifths
            </button>
          </div>

          {/* SVG export */}
          <button
            onClick={exportSvg}
            disabled={!isPro}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              isPro
                ? 'bg-emerald-700 text-white hover:bg-emerald-600'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50'
            }`}
            title={!isPro ? 'Pro tier required for SVG export' : 'Export graph as SVG'}
          >
            Export SVG {!isPro && <span className="text-yellow-500 ml-1">Pro</span>}
          </button>
        </div>

        {/* Root filter */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-gray-400 font-medium uppercase mr-1">Root filter:</span>
          <button
            className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
              rootFilter.size === 0 ? 'bg-gray-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
            onClick={() => setRootFilter(new Set())}
          >
            All
          </button>
          {Array.from({ length: 12 }, (_, i) => i).map(pc => (
            <button
              key={pc}
              onClick={() => toggleRoot(pc)}
              className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors`}
              style={{
                backgroundColor: rootFilter.has(pc) ? PC_COLORS[pc] + 'cc' : '#374151',
                color: rootFilter.has(pc) ? '#fff' : '#9ca3af',
                border: `1px solid ${rootFilter.has(pc) ? PC_COLORS[pc] : 'transparent'}`,
              }}
            >
              {NOTE_NAMES[pc as PitchClass]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Graph + Side panel ── */}
      <div className="flex gap-4">
        {/* SVG Graph */}
        <div className="bg-gray-800 rounded-lg p-2 flex-1 relative" style={{ minHeight: 440 }}>
          {isSimulating && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-80 rounded-lg z-10">
              <span className="text-gray-400 text-sm animate-pulse">Computing graph…</span>
            </div>
          )}

          <svg
            ref={svgRef}
            viewBox={`0 0 ${SIM_WIDTH} ${SIM_HEIGHT}`}
            className="w-full rounded cursor-default select-none"
            style={{ maxHeight: 580, touchAction: 'none' }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Edges */}
            <g>
              {edges.map((e, i) => {
                const s = nodeMap.get(e.source);
                const t = nodeMap.get(e.target);
                if (!s || !t) return null;
                const isHovered =
                  hoveredEdge?.source === e.source && hoveredEdge?.target === e.target;
                const dimmed = isEdgeDimmed(e);
                return (
                  <line
                    key={i}
                    x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                    stroke={isHovered ? '#fff' : edgeColor(e)}
                    strokeWidth={isHovered ? 3 : e.distance === 1 ? 2 : 1}
                    opacity={dimmed ? 0.04 : isHovered ? 1 : edgeOpacity(e)}
                    style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                    onMouseEnter={() => setHoveredEdge({ source: e.source, target: e.target })}
                    onMouseLeave={() => setHoveredEdge(null)}
                    onClick={() => handleEdgeClick(e)}
                  />
                );
              })}
            </g>

            {/* Nodes */}
            <g>
              {nodes.map(n => {
                const r = nodeRadius(n);
                const color = PC_COLORS[n.root] ?? '#6366f1';
                const isSelected = selectedNode === n.id;
                const isNeighbor = neighborIds.has(n.id);
                const dimmed = isNodeDimmed(n.id);
                const isHoveredNode = hoveredNode === n.id;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x},${n.y})`}
                    style={{ cursor: 'pointer' }}
                    onMouseDown={e => handleMouseDown(e, n.id)}
                    onMouseEnter={() => setHoveredNode(n.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => handleNodeClick(n)}
                  >
                    {/* Glow ring for selected/neighbor */}
                    {(isSelected || isNeighbor) && (
                      <circle
                        r={r + 5}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                        opacity={isSelected ? 1 : 0.4}
                      />
                    )}
                    <circle
                      r={isHoveredNode ? r + 2 : r}
                      fill={color}
                      fillOpacity={dimmed ? 0.12 : isSelected ? 1 : 0.75}
                      stroke={isSelected ? '#fff' : color}
                      strokeWidth={isSelected ? 2.5 : 1}
                      style={{ transition: 'r 0.1s, fill-opacity 0.15s' }}
                    />
                    {/* Label — only show if not too small */}
                    {r >= 13 && (
                      <text
                        textAnchor="middle"
                        y={4}
                        fontSize={r >= 16 ? 9 : 7}
                        fontWeight="600"
                        fill={dimmed ? '#4b5563' : '#fff'}
                        className="pointer-events-none"
                      >
                        {n.templateName}
                      </text>
                    )}
                    {r < 13 && !dimmed && (
                      <title>{n.templateName}</title>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Stats bar */}
          <div className="mt-1 px-2 flex gap-4 text-xs text-gray-500">
            <span>{nodes.length} chords</span>
            <span>{edges.length} connections</span>
            <span>max dist {maxDistance}</span>
          </div>
        </div>

        {/* ── Side Panel ── */}
        <div className="w-64 shrink-0 space-y-3">
          {/* Legend */}
          <div className="bg-gray-800 rounded-lg p-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Legend</h3>
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 12 }, (_, i) => i).map(pc => (
                <div key={pc} className="flex items-center gap-1">
                  <span
                    className="inline-block w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: PC_COLORS[pc] }}
                  />
                  <span className="text-xs text-gray-300">{NOTE_NAMES[pc as PitchClass]}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Edge color:</span>
                <span className="text-xs" style={{ color: edgeColor({ source: '', target: '', distance: 1 }) }}>close</span>
                <span className="text-xs text-gray-500">→</span>
                <span className="text-xs" style={{ color: edgeColor({ source: '', target: '', distance: maxDistance }) }}>far</span>
              </div>
              <div className="text-xs text-gray-400">Node size = connection count</div>
            </div>
          </div>

          {/* Detail panel: voice-leading info for clicked node/edge */}
          {(sidePanelChord || voiceDetails) ? (
            <div className="bg-gray-800 rounded-lg p-3 space-y-3">
              {sidePanelChord && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase mb-1">
                    {voiceDetails ? 'Edge Voice Leading' : 'Chord'}
                  </h3>
                  <div className="text-base font-bold text-white">{sidePanelChord.templateName}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Notes: {sidePanelChord.pcs.map(pc => NOTE_NAMES[pc as PitchClass]).join(' – ')}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {edges.filter(e => e.source === sidePanelChord.id || e.target === sidePanelChord.id).length} connection{edges.filter(e => e.source === sidePanelChord.id || e.target === sidePanelChord.id).length !== 1 ? 's' : ''}
                  </div>
                  <button
                    className="mt-2 w-full py-1 rounded text-xs font-semibold bg-indigo-700 hover:bg-indigo-600 text-white transition-colors"
                    onClick={() => playPitchClasses(sidePanelChord.pcs as PitchClass[], 'chord', 1.5)}
                  >
                    Play chord
                  </button>
                </div>
              )}

              {voiceDetails && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Voice Movements</h3>
                  <div className="space-y-1">
                    {voiceDetails.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="font-mono w-5 text-gray-300">{NOTE_NAMES[v.from as PitchClass]}</span>
                        <span className="text-gray-500">→</span>
                        <span className="font-mono w-5 text-gray-300">{NOTE_NAMES[v.to as PitchClass]}</span>
                        <span className={`ml-auto font-semibold ${
                          v.movement === 0 ? 'text-emerald-400' :
                          v.movement === 1 ? 'text-blue-400' :
                          v.movement === 2 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {v.movement === 0 ? 'common tone' : `±${v.movement} st`}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400">
                    Total movement: <span className="text-white font-semibold">
                      {voiceDetails.reduce((s, v) => s + v.movement, 0)} semitones
                    </span>
                  </div>
                </div>
              )}

              {/* Neighbors list (when a node is selected) */}
              {selectedNode && neighborIds.size > 0 && !voiceDetails && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                    Neighbors ({neighborIds.size})
                  </h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {Array.from(neighborIds).map(nid => {
                      const nbr = nodeMap.get(nid);
                      if (!nbr) return null;
                      // find edge between selected and neighbor
                      const edge = edges.find(e =>
                        (e.source === selectedNode && e.target === nid) ||
                        (e.target === selectedNode && e.source === nid)
                      );
                      return (
                        <div
                          key={nid}
                          className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-gray-700 cursor-pointer"
                          onClick={() => {
                            if (edge) handleEdgeClick(edge);
                          }}
                        >
                          <span className="flex items-center gap-1.5">
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ backgroundColor: PC_COLORS[nbr.root] }}
                            />
                            <span className="text-xs text-gray-200">{nbr.templateName}</span>
                          </span>
                          {edge && (
                            <span className="text-xs font-mono text-gray-500">{edge.distance}st</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-500">
              Click a node to select a chord and see its voice-leading neighbors.<br /><br />
              Click an edge to hear the progression and see voice-leading details.
            </div>
          )}

          {/* Tier notice */}
          {!isPro && (
            <div className="bg-yellow-950 border border-yellow-700 rounded-lg p-3 text-xs text-yellow-400">
              <strong className="font-semibold">Free tier:</strong> triads only (24 nodes). Upgrade to Pro for 7th chords (60+ nodes) and SVG export.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

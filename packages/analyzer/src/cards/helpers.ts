const NOTE_NAMES = ['C', 'C\u266F', 'D', 'E\u266D', 'E', 'F', 'F\u266F', 'G', 'A\u266D', 'A', 'B\u266D', 'B'];

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function pcToXY(pc: number, cx: number, cy: number, radius: number): { x: number; y: number } {
  const angle = (pc * 30 - 90) * (Math.PI / 180);
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export function noteName(pc: number): string {
  return NOTE_NAMES[pc % 12];
}

export function drawOrbit(
  pcs: number[],
  cx: number,
  cy: number,
  radius: number,
  opts: { activeColor?: string; inactiveColor?: string; lineColor?: string; showLabels?: boolean; labelColor?: string; dotRadius?: number } = {}
): string {
  const {
    activeColor = '#22c55e',
    inactiveColor = '#334155',
    lineColor = '#22c55e',
    showLabels = true,
    labelColor = '#94a3b8',
    dotRadius = 6,
  } = opts;

  let svg = '';

  // Draw polygon connecting active PCs
  if (pcs.length >= 2) {
    const points = pcs.map(pc => {
      const { x, y } = pcToXY(pc, cx, cy, radius);
      return `${x},${y}`;
    }).join(' ');
    svg += `<polygon points="${points}" fill="${lineColor}" fill-opacity="0.1" stroke="${lineColor}" stroke-width="2" stroke-linejoin="round"/>`;
  }

  // Draw all 12 positions
  for (let i = 0; i < 12; i++) {
    const { x, y } = pcToXY(i, cx, cy, radius);
    const isActive = pcs.includes(i);
    svg += `<circle cx="${x}" cy="${y}" r="${isActive ? dotRadius : dotRadius * 0.6}" fill="${isActive ? activeColor : inactiveColor}"/>`;
    if (showLabels) {
      const labelPos = pcToXY(i, cx, cy, radius + 18);
      svg += `<text x="${labelPos.x}" y="${labelPos.y}" text-anchor="middle" dominant-baseline="central" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11" fill="${isActive ? activeColor : labelColor}">${noteName(i)}</text>`;
    }
  }

  return svg;
}

export function drawKeyboard(
  pcs: number[],
  x: number,
  y: number,
  width: number,
  height: number,
  opts: { activeColor?: string } = {}
): string {
  const { activeColor = '#22c55e' } = opts;
  const whiteKeys = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
  const blackKeys = [1, 3, 6, 8, 10]; // C# D# F# G# A#
  const whiteKeyWidth = width / 7;
  const blackKeyWidth = whiteKeyWidth * 0.6;
  const blackKeyHeight = height * 0.6;

  let svg = '';

  // White keys
  whiteKeys.forEach((pc, i) => {
    const kx = x + i * whiteKeyWidth;
    const isActive = pcs.includes(pc);
    svg += `<rect x="${kx}" y="${y}" width="${whiteKeyWidth - 1}" height="${height}" rx="2" fill="${isActive ? activeColor : '#e2e8f0'}" stroke="#475569" stroke-width="1"/>`;
  });

  // Black keys
  const blackKeyPositions = [0.7, 1.7, 3.7, 4.7, 5.7]; // relative to white key indices
  blackKeys.forEach((pc, i) => {
    const kx = x + blackKeyPositions[i] * whiteKeyWidth - blackKeyWidth / 2;
    const isActive = pcs.includes(pc);
    svg += `<rect x="${kx}" y="${y}" width="${blackKeyWidth}" height="${blackKeyHeight}" rx="2" fill="${isActive ? activeColor : '#1e293b'}" stroke="#475569" stroke-width="1"/>`;
  });

  return svg;
}

export function drawTonnetz(
  pcs: number[],
  x: number,
  y: number,
  cellSize: number
): string {
  let svg = '';
  // Simplified tonnetz: 4x3 grid, major thirds horizontal, minor thirds diagonal
  const tonnetzGrid = [
    [3, 7, 11, 3],
    [0, 4, 8, 0],
    [9, 1, 5, 9],
    [6, 10, 2, 6],
  ];

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const pc = tonnetzGrid[row][col];
      const nx = x + col * cellSize + (row % 2) * (cellSize / 2);
      const ny = y + row * cellSize * 0.866;
      const isActive = pcs.includes(pc);

      // Draw connecting lines to neighbors
      if (col < 3) {
        const nx2 = x + (col + 1) * cellSize + (row % 2) * (cellSize / 2);
        svg += `<line x1="${nx}" y1="${ny}" x2="${nx2}" y2="${ny}" stroke="#334155" stroke-width="1"/>`;
      }
      if (row < 3) {
        const nx2 = x + col * cellSize + ((row + 1) % 2) * (cellSize / 2);
        const ny2 = y + (row + 1) * cellSize * 0.866;
        svg += `<line x1="${nx}" y1="${ny}" x2="${nx2}" y2="${ny2}" stroke="#334155" stroke-width="1"/>`;
      }

      svg += `<circle cx="${nx}" cy="${ny}" r="${isActive ? 12 : 6}" fill="${isActive ? '#22c55e' : '#475569'}" ${isActive ? 'filter="url(#glow)"' : ''}/>`;
      if (isActive) {
        svg += `<text x="${nx}" y="${ny}" text-anchor="middle" dominant-baseline="central" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="9" fill="#fff" font-weight="bold">${noteName(pc)}</text>`;
      }
    }
  }

  return svg;
}

export function watermark(x: number, y: number, color: string = '#475569'): string {
  return `<text x="${x}" y="${y}" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="12" fill="${color}" opacity="0.7">symmetry.tendrid.us</text>`;
}

export function svgWrapper(width: number, height: number, content: string, defs: string = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glow-strong">
      <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    ${defs}
  </defs>
  ${content}
</svg>`;
}

export function backgroundRect(width: number, height: number, color: string = '#0f172a'): string {
  return `<rect width="${width}" height="${height}" fill="${color}"/>`;
}

export function fontStack(): string {
  return "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
}

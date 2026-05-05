import type { CardStyle, CardParams } from './types.js';
import {
  escapeXml,
  pcToXY,
  noteName,
  drawOrbit,
  drawKeyboard,
  drawTonnetz,
  watermark,
  svgWrapper,
  backgroundRect,
  fontStack,
} from './helpers.js';

export function renderCard(style: CardStyle, params: CardParams): string {
  switch (style) {
    case 'orbit': return renderOrbit(params);
    case 'identity': return renderIdentity(params);
    case 'spectrum': return renderSpectrum(params);
    case 'comparison': return renderComparison(params);
    case 'keyboard': return renderKeyboardCard(params);
    case 'molecule': return renderMolecule(params);
    case 'interval-dna': return renderIntervalDna(params);
    case 'tonnetz': return renderTonnetzCard(params);
    case 'gradient': return renderGradient(params);
    case 'minimal': return renderMinimal(params);
    case 'academic': return renderAcademic(params);
    case 'neon': return renderNeon(params);
    case 'blueprint': return renderBlueprint(params);
    case 'constellation': return renderConstellation(params);
    case 'waveform': return renderWaveform(params);
    case 'badge': return renderBadge(params);
    case 'story': return renderStory(params);
    case 'banner': return renderBanner(params);
    case 'quote': return renderQuote(params);
    case 'timeline': return renderTimeline(params);
    default: return renderOrbit(params);
  }
}

// ─── 1. ORBIT ───────────────────────────────────────────────────────────────────

function renderOrbit(params: CardParams): string {
  const { pcs, group, chordName, stabilizerOrder: so } = params;
  const W = 1200, H = 630;
  const font = fontStack();

  let content = backgroundRect(W, H);

  // Subtle grid
  for (let i = 0; i < 12; i++) {
    const { x, y } = pcToXY(i, 600, 315, 220);
    content += `<line x1="600" y1="315" x2="${x}" y2="${y}" stroke="#1e293b" stroke-width="1"/>`;
  }

  content += drawOrbit(pcs, 600, 315, 200, { dotRadius: 8, showLabels: true });

  // Title area
  const displayName = chordName || pcs.map(noteName).join(' ');
  content += `<text x="80" y="100" font-family="${font}" font-size="42" font-weight="bold" fill="#f8fafc">${escapeXml(displayName)}</text>`;

  if (group) {
    content += `<text x="80" y="150" font-family="${font}" font-size="28" fill="#6366f1">${escapeXml(group)}</text>`;
  }
  if (so !== undefined) {
    content += `<text x="80" y="195" font-family="${font}" font-size="18" fill="#94a3b8">Stabilizer Order: ${so}</text>`;
  }

  content += watermark(W - 30, H - 20);
  return svgWrapper(W, H, content);
}

// ─── 2. IDENTITY ────────────────────────────────────────────────────────────────

function renderIdentity(params: CardParams): string {
  const { pcs, group, chordName, mullikenLabel } = params;
  const W = 1200, H = 630;
  const font = fontStack();

  let content = backgroundRect(W, H, '#111827');

  const name = chordName || pcs.map(noteName).join(' ');
  content += `<text x="600" y="260" text-anchor="middle" font-family="${font}" font-size="72" font-weight="bold" fill="#f8fafc">${escapeXml(name)}</text>`;

  if (group) {
    content += `<rect x="${600 - group.length * 10}" y="290" width="${group.length * 20 + 40}" height="44" rx="22" fill="#6366f1" fill-opacity="0.2" stroke="#6366f1" stroke-width="2"/>`;
    content += `<text x="600" y="318" text-anchor="middle" font-family="${font}" font-size="22" fill="#6366f1">${escapeXml(group)}</text>`;
  }

  if (mullikenLabel) {
    content += `<text x="600" y="380" text-anchor="middle" font-family="${font}" font-size="18" fill="#94a3b8">Mulliken: ${escapeXml(mullikenLabel)}</text>`;
  }

  // Mini orbit in corner
  content += drawOrbit(pcs, 1050, 130, 80, { dotRadius: 4, showLabels: false });

  content += watermark(W - 30, H - 20);
  return svgWrapper(W, H, content);
}

// ─── 3. SPECTRUM ────────────────────────────────────────────────────────────────

function renderSpectrum(params: CardParams): string {
  const { pcs, group, stabilizerOrder: so, chordName } = params;
  const W = 1200, H = 630;
  const font = fontStack();
  const order = so || 1;
  const maxOrder = 12;
  const position = order / maxOrder;

  let content = backgroundRect(W, H);

  content += `<text x="600" y="120" text-anchor="middle" font-family="${font}" font-size="36" font-weight="bold" fill="#f8fafc">Symmetry Spectrum</text>`;

  if (chordName || group) {
    content += `<text x="600" y="170" text-anchor="middle" font-family="${font}" font-size="22" fill="#94a3b8">${escapeXml(chordName || '')} ${group ? '(' + escapeXml(group) + ')' : ''}</text>`;
  }

  // Gradient bar
  const barX = 100, barY = 280, barW = 1000, barH = 50;
  const defs = `<linearGradient id="specGrad" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#475569"/>
    <stop offset="50%" stop-color="#6366f1"/>
    <stop offset="100%" stop-color="#ec4899"/>
  </linearGradient>`;

  content += `<rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="25" fill="url(#specGrad)"/>`;

  // Marker
  const markerX = barX + position * barW;
  content += `<circle cx="${markerX}" cy="${barY + barH / 2}" r="18" fill="#f8fafc" stroke="#0f172a" stroke-width="3"/>`;
  content += `<text x="${markerX}" y="${barY + barH / 2 + 1}" text-anchor="middle" dominant-baseline="central" font-family="${font}" font-size="14" font-weight="bold" fill="#0f172a">${order}</text>`;

  // Arrow above
  content += `<polygon points="${markerX - 8},${barY - 15} ${markerX + 8},${barY - 15} ${markerX},${barY - 5}" fill="#f8fafc"/>`;

  // Labels
  content += `<text x="${barX}" y="${barY + barH + 35}" font-family="${font}" font-size="16" fill="#64748b">Asymmetric (C\u2081)</text>`;
  content += `<text x="${barX + barW}" y="${barY + barH + 35}" text-anchor="end" font-family="${font}" font-size="16" fill="#64748b">Fully Symmetric (D\u2081\u2082)</text>`;

  // PC set display
  content += `<text x="600" y="480" text-anchor="middle" font-family="${font}" font-size="20" fill="#cbd5e1">{${pcs.join(', ')}}</text>`;

  content += watermark(W - 30, H - 20);
  return svgWrapper(W, H, content, defs);
}

// ─── 4. COMPARISON ──────────────────────────────────────────────────────────────

function renderComparison(params: CardParams): string {
  const { pcs, comparePcs, group, vlDistance, title, subtitle } = params;
  const W = 1200, H = 630;
  const font = fontStack();
  const rightPcs = comparePcs || [];

  let content = backgroundRect(W, H);

  // Divider
  content += `<line x1="600" y1="80" x2="600" y2="550" stroke="#334155" stroke-width="2" stroke-dasharray="6,4"/>`;

  // Left side
  content += drawOrbit(pcs, 300, 300, 140, { dotRadius: 6 });
  content += `<text x="300" y="80" text-anchor="middle" font-family="${font}" font-size="20" fill="#f8fafc">${escapeXml(title || pcs.map(noteName).join(' '))}</text>`;

  // Right side
  if (rightPcs.length > 0) {
    content += drawOrbit(rightPcs, 900, 300, 140, { dotRadius: 6, activeColor: '#f97316', lineColor: '#f97316' });
    content += `<text x="900" y="80" text-anchor="middle" font-family="${font}" font-size="20" fill="#f8fafc">${escapeXml(subtitle || rightPcs.map(noteName).join(' '))}</text>`;
  }

  // VL distance in center
  if (vlDistance !== undefined) {
    content += `<rect x="560" y="290" width="80" height="40" rx="20" fill="#f97316" fill-opacity="0.2" stroke="#f97316" stroke-width="2"/>`;
    content += `<text x="600" y="315" text-anchor="middle" font-family="${font}" font-size="16" font-weight="bold" fill="#f97316">${vlDistance}</text>`;
    content += `<text x="600" y="350" text-anchor="middle" font-family="${font}" font-size="12" fill="#94a3b8">VL dist</text>`;
  }

  content += watermark(W - 30, H - 20);
  return svgWrapper(W, H, content);
}

// ─── 5. KEYBOARD ────────────────────────────────────────────────────────────────

function renderKeyboardCard(params: CardParams): string {
  const { pcs, group, chordName } = params;
  const W = 1200, H = 630;
  const font = fontStack();

  let content = backgroundRect(W, H, '#111827');

  content += drawKeyboard(pcs, 100, 200, 1000, 280);

  const name = chordName || pcs.map(noteName).join(' ');
  content += `<text x="600" y="100" text-anchor="middle" font-family="${font}" font-size="36" font-weight="bold" fill="#f8fafc">${escapeXml(name)}</text>`;

  if (group) {
    content += `<text x="600" y="145" text-anchor="middle" font-family="${font}" font-size="20" fill="#6366f1">${escapeXml(group)}</text>`;
  }

  // Note labels below keyboard
  content += `<text x="600" y="540" text-anchor="middle" font-family="${font}" font-size="18" fill="#94a3b8">{${pcs.join(', ')}}</text>`;

  content += watermark(W - 30, H - 20);
  return svgWrapper(W, H, content);
}

// ─── 6. MOLECULE ────────────────────────────────────────────────────────────────

function renderMolecule(params: CardParams): string {
  const { pcs, group } = params;
  const W = 1200, H = 630;
  const font = fontStack();

  let content = backgroundRect(W, H, '#0f172a');

  // Determine molecular shape from group
  const n = pcs.length;
  const cx = 600, cy = 300;
  const radius = 150;

  // Draw molecule shape
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i * 360 / n - 90) * Math.PI / 180;
    points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }

  // Bonds
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    content += `<line x1="${points[i].x}" y1="${points[i].y}" x2="${next.x}" y2="${next.y}" stroke="#94a3b8" stroke-width="3"/>`;
  }

  // Atoms
  points.forEach((p, i) => {
    content += `<circle cx="${p.x}" cy="${p.y}" r="24" fill="#1e293b" stroke="#22c55e" stroke-width="3"/>`;
    content += `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" font-family="${font}" font-size="14" font-weight="bold" fill="#22c55e">${noteName(pcs[i])}</text>`;
  });

  // Point group label
  const pointGroup = groupToMolecular(group || 'C\u2081');
  content += `<text x="600" y="530" text-anchor="middle" font-family="${font}" font-size="28" fill="#f8fafc">Point Group: ${escapeXml(pointGroup)}</text>`;
  content += `<text x="600" y="570" text-anchor="middle" font-family="${font}" font-size="18" fill="#94a3b8">Musical \u2194 Molecular Symmetry</text>`;

  content += watermark(W - 30, H - 20);
  return svgWrapper(W, H, content);
}

function groupToMolecular(group: string): string {
  // Map musical groups to molecular point groups
  if (group.startsWith('D\u2081\u2082') || group === 'D12') return 'D\u2081\u2082h';
  if (group.startsWith('D') || group.startsWith('D')) return group + 'h';
  if (group.startsWith('C')) return group + 'v';
  return group;
}

// ─── 7. INTERVAL DNA ────────────────────────────────────────────────────────────

function renderIntervalDna(params: CardParams): string {
  const { pcs, intervalVector: iv, group, chordName } = params;
  const W = 1200, H = 630;
  const font = fontStack();
  const vector = iv || [0, 0, 0, 0, 0, 0];

  let content = backgroundRect(W, H, '#0f172a');

  content += `<text x="600" y="80" text-anchor="middle" font-family="${font}" font-size="32" font-weight="bold" fill="#f8fafc">Interval DNA</text>`;
  if (chordName) {
    content += `<text x="600" y="120" text-anchor="middle" font-family="${font}" font-size="18" fill="#94a3b8">${escapeXml(chordName)}</text>`;
  }

  const maxVal = Math.max(...vector, 1);
  const barWidth = 100;
  const gap = 50;
  const startX = 600 - (6 * barWidth + 5 * gap) / 2;
  const maxBarHeight = 320;
  const barBaseY = 520;

  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6'];
  const labels = ['m2/M7', 'M2/m7', 'm3/M6', 'M3/m6', 'P4/P5', 'tt'];

  vector.forEach((val, i) => {
    const barH = (val / maxVal) * maxBarHeight;
    const bx = startX + i * (barWidth + gap);
    content += `<rect x="${bx}" y="${barBaseY - barH}" width="${barWidth}" height="${barH}" fill="${colors[i]}" rx="4" opacity="0.85"/>`;
    content += `<text x="${bx + barWidth / 2}" y="${barBaseY - barH - 12}" text-anchor="middle" font-family="${font}" font-size="20" font-weight="bold" fill="${colors[i]}">${val}</text>`;
    content += `<text x="${bx + barWidth / 2}" y="${barBaseY + 25}" text-anchor="middle" font-family="${font}" font-size="13" fill="#94a3b8">${labels[i]}</text>`;
  });

  // Vector notation
  content += `<text x="600" y="${barBaseY + 60}" text-anchor="middle" font-family="${font}" font-size="16" fill="#64748b">[${vector.join(', ')}]</text>`;

  if (group) {
    content += `<text x="80" y="580" font-family="${font}" font-size="16" fill="#6366f1">${escapeXml(group)}</text>`;
  }

  content += watermark(W - 30, H - 20);
  return svgWrapper(W, H, content);
}

// ─── 8. TONNETZ ─────────────────────────────────────────────────────────────────

function renderTonnetzCard(params: CardParams): string {
  const { pcs, group, chordName } = params;
  const W = 1200, H = 630;
  const font = fontStack();

  let content = backgroundRect(W, H, '#0f172a');

  content += `<text x="600" y="70" text-anchor="middle" font-family="${font}" font-size="32" font-weight="bold" fill="#f8fafc">${escapeXml(chordName || 'Tonnetz Position')}</text>`;
  if (group) {
    content += `<text x="600" y="105" text-anchor="middle" font-family="${font}" font-size="18" fill="#6366f1">${escapeXml(group)}</text>`;
  }

  content += drawTonnetz(pcs, 300, 150, 120);

  content += watermark(W - 30, H - 20);
  return svgWrapper(W, H, content);
}

// ─── 9. GRADIENT ────────────────────────────────────────────────────────────────

function renderGradient(params: CardParams): string {
  const { pcs, intervalVector: iv, group } = params;
  const W = 1200, H = 630;
  const font = fontStack();
  const vector = iv || [0, 0, 0, 0, 0, 0];

  // Generate colors from interval vector
  const hue1 = (vector[0] * 60) % 360;
  const hue2 = (vector[2] * 90 + 120) % 360;
  const hue3 = (vector[4] * 45 + 240) % 360;

  const defs = `
    <radialGradient id="grad1" cx="30%" cy="40%">
      <stop offset="0%" stop-color="hsl(${hue1}, 80%, 50%)" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="grad2" cx="70%" cy="60%">
      <stop offset="0%" stop-color="hsl(${hue2}, 70%, 45%)" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="grad3" cx="50%" cy="30%">
      <stop offset="0%" stop-color="hsl(${hue3}, 75%, 55%)" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>`;

  let content = backgroundRect(W, H, '#0f0f1a');
  content += `<rect width="${W}" height="${H}" fill="url(#grad1)"/>`;
  content += `<rect width="${W}" height="${H}" fill="url(#grad2)"/>`;
  content += `<rect width="${W}" height="${H}" fill="url(#grad3)"/>`;

  if (group) {
    content += `<text x="600" y="330" text-anchor="middle" font-family="${font}" font-size="48" font-weight="bold" fill="#ffffff" opacity="0.9">${escapeXml(group)}</text>`;
  }

  content += `<text x="600" y="560" text-anchor="middle" font-family="${font}" font-size="14" fill="#ffffff" opacity="0.5">{${pcs.join(', ')}}</text>`;

  content += watermark(W - 30, H - 20, '#ffffff');
  return svgWrapper(W, H, content, defs);
}

// ─── 10. MINIMAL ────────────────────────────────────────────────────────────────

function renderMinimal(params: CardParams): string {
  const { pcs, group } = params;
  const W = 1200, H = 630;
  const font = fontStack();

  let content = backgroundRect(W, H, '#000000');

  const setNotation = `{${pcs.join(', ')}}`;
  const groupStr = group || 'C\u2081';

  content += `<text x="600" y="290" text-anchor="middle" font-family="${font}" font-size="64" fill="#ffffff" font-weight="300">${escapeXml(setNotation)}</text>`;
  content += `<text x="600" y="370" text-anchor="middle" font-family="${font}" font-size="32" fill="#94a3b8">\u2208 ${escapeXml(groupStr)}</text>`;

  content += watermark(W - 30, H - 20, '#333333');
  return svgWrapper(W, H, content);
}

// ─── 11. ACADEMIC ───────────────────────────────────────────────────────────────

function renderAcademic(params: CardParams): string {
  const { pcs, group, forteNumber, intervalVector: iv, chordName, stabilizerOrder: so } = params;
  const W = 1200, H = 630;
  const font = fontStack();
  const vector = iv || [0, 0, 0, 0, 0, 0];

  let content = backgroundRect(W, H, '#fefce8');

  // Border
  content += `<rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="none" stroke="#1c1917" stroke-width="2"/>`;
  content += `<rect x="25" y="25" width="${W - 50}" height="${H - 50}" fill="none" stroke="#1c1917" stroke-width="0.5"/>`;

  // Figure label
  content += `<text x="60" y="70" font-family="${font}" font-size="14" fill="#1c1917" font-style="italic">Fig. 1: Pitch-Class Set Analysis</text>`;

  // Orbit diagram
  content += drawOrbit(pcs, 300, 350, 160, { activeColor: '#1c1917', inactiveColor: '#d6d3d1', lineColor: '#1c1917', labelColor: '#57534e' });

  // Data table on right
  let ty = 130;
  const tx = 600;
  const lineH = 38;

  content += `<text x="${tx}" y="${ty}" font-family="${font}" font-size="18" fill="#1c1917" font-weight="bold">Analysis Summary</text>`;
  ty += lineH;
  content += `<line x1="${tx}" y1="${ty - 10}" x2="1120" y2="${ty - 10}" stroke="#1c1917" stroke-width="0.5"/>`;

  const rows: [string, string][] = [
    ['Pitch-Class Set:', `{${pcs.join(', ')}}`],
    ['Chord Name:', chordName || 'N/A'],
    ['Abstract Group:', group || 'C\u2081'],
    ['Forte Number:', forteNumber || 'N/A'],
    ['Interval Vector:', `[${vector.join(', ')}]`],
    ['Stabilizer Order:', String(so || 1)],
  ];

  rows.forEach(([label, value]) => {
    ty += lineH;
    content += `<text x="${tx}" y="${ty}" font-family="${font}" font-size="15" fill="#57534e">${escapeXml(label)}</text>`;
    content += `<text x="880" y="${ty}" font-family="${font}" font-size="15" fill="#1c1917" font-weight="600">${escapeXml(value)}</text>`;
  });

  content += `<text x="600" y="${H - 50}" font-family="${font}" font-size="11" fill="#78716c" font-style="italic">Generated by Musical Symmetry Classifier \u2014 symmetry.tendrid.us</text>`;

  return svgWrapper(W, H, content);
}

// ─── 12. NEON ───────────────────────────────────────────────────────────────────

function renderNeon(params: CardParams): string {
  const { pcs, group, chordName } = params;
  const W = 1200, H = 630;
  const font = fontStack();

  let content = backgroundRect(W, H, '#0a0014');

  // Perspective grid
  for (let i = 0; i <= 20; i++) {
    const x = i * (W / 20);
    const opacity = 0.15 + (i % 5 === 0 ? 0.1 : 0);
    content += `<line x1="${x}" y1="400" x2="${x + (x - 600) * 0.5}" y2="${H}" stroke="#6366f1" stroke-width="1" opacity="${opacity}"/>`;
  }
  for (let i = 0; i < 5; i++) {
    const y = 400 + i * 50;
    content += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#6366f1" stroke-width="1" opacity="0.2"/>`;
  }

  // Neon orbit
  if (pcs.length >= 2) {
    const points = pcs.map(pc => {
      const { x, y } = pcToXY(pc, 600, 250, 170);
      return `${x},${y}`;
    }).join(' ');
    content += `<polygon points="${points}" fill="none" stroke="#ec4899" stroke-width="4" filter="url(#glow-strong)"/>`;
    content += `<polygon points="${points}" fill="none" stroke="#06b6d4" stroke-width="2" opacity="0.5"/>`;
  }

  // Dots with neon glow
  pcs.forEach(pc => {
    const { x, y } = pcToXY(pc, 600, 250, 170);
    content += `<circle cx="${x}" cy="${y}" r="8" fill="#ec4899" filter="url(#glow)"/>`;
    content += `<circle cx="${x}" cy="${y}" r="4" fill="#ffffff"/>`;
  });

  // Text with neon effect
  const name = chordName || pcs.map(noteName).join(' ');
  content += `<text x="600" y="60" text-anchor="middle" font-family="${font}" font-size="36" font-weight="bold" fill="#06b6d4" filter="url(#glow)">${escapeXml(name)}</text>`;

  if (group) {
    content += `<text x="600" y="480" text-anchor="middle" font-family="${font}" font-size="28" fill="#ec4899" filter="url(#glow)">${escapeXml(group)}</text>`;
  }

  content += watermark(W - 30, H - 20, '#6366f1');
  return svgWrapper(W, H, content);
}

// ─── 13. BLUEPRINT ──────────────────────────────────────────────────────────────

function renderBlueprint(params: CardParams): string {
  const { pcs, group, intervalVector: iv, chordName } = params;
  const W = 1200, H = 630;
  const font = fontStack();
  const vector = iv || [0, 0, 0, 0, 0, 0];

  let content = backgroundRect(W, H, '#1e3a5f');

  // Grid
  for (let x = 0; x <= W; x += 30) {
    content += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#2d5a8a" stroke-width="${x % 150 === 0 ? 1 : 0.3}"/>`;
  }
  for (let y = 0; y <= H; y += 30) {
    content += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#2d5a8a" stroke-width="${y % 150 === 0 ? 1 : 0.3}"/>`;
  }

  // Orbit as technical drawing
  content += drawOrbit(pcs, 420, 340, 180, {
    activeColor: '#ffffff',
    inactiveColor: '#4a7faa',
    lineColor: '#ffffff',
    labelColor: '#8ec5f0',
    dotRadius: 5,
  });

  // Dimension lines for intervals
  if (pcs.length >= 2) {
    for (let i = 0; i < pcs.length - 1; i++) {
      const p1 = pcToXY(pcs[i], 420, 340, 180);
      const p2 = pcToXY(pcs[(i + 1) % pcs.length], 420, 340, 180);
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const interval = ((pcs[(i + 1) % pcs.length] - pcs[i]) + 12) % 12;
      content += `<text x="${mx}" y="${my - 10}" text-anchor="middle" font-family="${font}" font-size="11" fill="#8ec5f0">${interval}st</text>`;
    }
  }

  // Title block (bottom right)
  content += `<rect x="750" y="450" width="400" height="140" fill="none" stroke="#ffffff" stroke-width="1.5"/>`;
  content += `<line x1="750" y1="490" x2="1150" y2="490" stroke="#ffffff" stroke-width="0.5"/>`;
  content += `<text x="950" y="478" text-anchor="middle" font-family="${font}" font-size="14" fill="#ffffff">${escapeXml(chordName || 'PITCH-CLASS SET')}</text>`;
  content += `<text x="770" y="520" font-family="${font}" font-size="12" fill="#8ec5f0">GROUP: ${escapeXml(group || 'C\u2081')}</text>`;
  content += `<text x="770" y="545" font-family="${font}" font-size="12" fill="#8ec5f0">IV: [${vector.join(', ')}]</text>`;
  content += `<text x="770" y="570" font-family="${font}" font-size="12" fill="#8ec5f0">PCS: {${pcs.join(', ')}}</text>`;

  content += `<text x="1130" y="585" text-anchor="end" font-family="${font}" font-size="10" fill="#4a7faa">symmetry.tendrid.us</text>`;

  return svgWrapper(W, H, content);
}

// ─── 14. CONSTELLATION ──────────────────────────────────────────────────────────

function renderConstellation(params: CardParams): string {
  const { pcs, group, chordName } = params;
  const W = 1200, H = 630;
  const font = fontStack();

  let content = backgroundRect(W, H, '#030712');

  // Star field background
  const seed = pcs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 80; i++) {
    const sx = ((seed * 17 + i * 131) % W);
    const sy = ((seed * 23 + i * 97) % H);
    const size = ((i * 7 + seed) % 3) + 0.5;
    const opacity = 0.2 + ((i * 13) % 40) / 100;
    content += `<circle cx="${sx}" cy="${sy}" r="${size}" fill="#ffffff" opacity="${opacity}"/>`;
  }

  // Constellation lines
  if (pcs.length >= 2) {
    const points = pcs.map(pc => pcToXY(pc, 600, 315, 220));
    for (let i = 0; i < points.length; i++) {
      const next = points[(i + 1) % points.length];
      content += `<line x1="${points[i].x}" y1="${points[i].y}" x2="${next.x}" y2="${next.y}" stroke="#ffffff" stroke-width="1" opacity="0.4" stroke-dasharray="4,3"/>`;
    }
  }

  // Stars (active PCs)
  pcs.forEach(pc => {
    const { x, y } = pcToXY(pc, 600, 315, 220);
    content += `<circle cx="${x}" cy="${y}" r="12" fill="#fef08a" filter="url(#glow)"/>`;
    content += `<circle cx="${x}" cy="${y}" r="5" fill="#ffffff"/>`;
    const labelPos = pcToXY(pc, 600, 315, 250);
    content += `<text x="${labelPos.x}" y="${labelPos.y}" text-anchor="middle" dominant-baseline="central" font-family="${font}" font-size="12" fill="#fef08a">${noteName(pc)}</text>`;
  });

  // Inactive as dim stars
  for (let i = 0; i < 12; i++) {
    if (!pcs.includes(i)) {
      const { x, y } = pcToXY(i, 600, 315, 220);
      content += `<circle cx="${x}" cy="${y}" r="2" fill="#6b7280" opacity="0.5"/>`;
    }
  }

  // Label
  const name = chordName || group || pcs.map(noteName).join(' ');
  content += `<text x="600" y="50" text-anchor="middle" font-family="${font}" font-size="24" fill="#fef08a" font-style="italic">\u201C${escapeXml(name)}\u201D</text>`;

  content += watermark(W - 30, H - 20, '#4b5563');
  return svgWrapper(W, H, content);
}

// ─── 15. WAVEFORM ───────────────────────────────────────────────────────────────

function renderWaveform(params: CardParams): string {
  const { pcs, intervalVector: iv, group, chordName } = params;
  const W = 1200, H = 630;
  const font = fontStack();
  const vector = iv || [0, 0, 0, 0, 0, 0];

  let content = backgroundRect(W, H, '#0f172a');

  // Generate waveform from interval vector
  const midY = 340;
  const amplitude = 120;
  const samples = 200;
  let pathD = `M 50 ${midY}`;

  for (let i = 0; i < samples; i++) {
    const x = 50 + (i / samples) * 1100;
    let y = 0;
    vector.forEach((val, idx) => {
      const freq = (idx + 1) * 2;
      y += val * Math.sin((i / samples) * Math.PI * freq * 2) / (idx + 1);
    });
    const normalizedY = midY - (y / 6) * amplitude;
    pathD += ` L ${x} ${normalizedY}`;
  }

  content += `<path d="${pathD}" fill="none" stroke="#22c55e" stroke-width="2.5" opacity="0.9"/>`;
  // Mirror
  let mirrorD = `M 50 ${midY}`;
  for (let i = 0; i < samples; i++) {
    const x = 50 + (i / samples) * 1100;
    let y = 0;
    vector.forEach((val, idx) => {
      const freq = (idx + 1) * 2;
      y += val * Math.sin((i / samples) * Math.PI * freq * 2) / (idx + 1);
    });
    const normalizedY = midY + (y / 6) * amplitude;
    mirrorD += ` L ${x} ${normalizedY}`;
  }
  content += `<path d="${mirrorD}" fill="none" stroke="#22c55e" stroke-width="1.5" opacity="0.4"/>`;

  // Center line
  content += `<line x1="50" y1="${midY}" x2="1150" y2="${midY}" stroke="#334155" stroke-width="1"/>`;

  // Title
  const name = chordName || pcs.map(noteName).join(' ');
  content += `<text x="600" y="80" text-anchor="middle" font-family="${font}" font-size="28" font-weight="bold" fill="#f8fafc">${escapeXml(name)}</text>`;
  if (group) {
    content += `<text x="600" y="115" text-anchor="middle" font-family="${font}" font-size="18" fill="#22c55e">${escapeXml(group)}</text>`;
  }

  content += `<text x="600" y="560" text-anchor="middle" font-family="${font}" font-size="14" fill="#64748b">Waveform synthesized from interval vector [${vector.join(', ')}]</text>`;

  content += watermark(W - 30, H - 20);
  return svgWrapper(W, H, content);
}

// ─── 16. BADGE ──────────────────────────────────────────────────────────────────

function renderBadge(params: CardParams): string {
  const { pcs, group, chordName, stabilizerOrder: so } = params;
  const W = 1200, H = 630;
  const font = fontStack();
  const cx = 600, cy = 315;

  let content = backgroundRect(W, H, '#111827');

  // Outer ring
  content += `<circle cx="${cx}" cy="${cy}" r="250" fill="none" stroke="#6366f1" stroke-width="4"/>`;
  content += `<circle cx="${cx}" cy="${cy}" r="240" fill="none" stroke="#6366f1" stroke-width="1" opacity="0.5"/>`;
  content += `<circle cx="${cx}" cy="${cy}" r="260" fill="none" stroke="#6366f1" stroke-width="1" opacity="0.3"/>`;

  // Orbit as border pattern
  content += drawOrbit(pcs, cx, cy, 200, { dotRadius: 7, showLabels: false, activeColor: '#fbbf24', lineColor: '#fbbf24' });

  // Center text
  const displayGroup = group || 'C\u2081';
  content += `<text x="${cx}" y="${cy - 10}" text-anchor="middle" font-family="${font}" font-size="48" font-weight="bold" fill="#f8fafc">${escapeXml(displayGroup)}</text>`;

  if (chordName) {
    content += `<text x="${cx}" y="${cy + 35}" text-anchor="middle" font-family="${font}" font-size="18" fill="#94a3b8">${escapeXml(chordName)}</text>`;
  }

  // Top arc text
  content += `<text x="${cx}" y="${cy - 270}" text-anchor="middle" font-family="${font}" font-size="14" fill="#6366f1" letter-spacing="4">SYMMETRY CERTIFIED</text>`;

  // Bottom arc text
  const orderLabel = so !== undefined ? `ORDER ${so}` : '';
  content += `<text x="${cx}" y="${cy + 285}" text-anchor="middle" font-family="${font}" font-size="14" fill="#6366f1" letter-spacing="4">${orderLabel}</text>`;

  content += watermark(W - 30, H - 20);
  return svgWrapper(W, H, content);
}

// ─── 17. STORY (1080x1920) ──────────────────────────────────────────────────────

function renderStory(params: CardParams): string {
  const { pcs, group, chordName, intervalVector: iv, stabilizerOrder: so, mullikenLabel } = params;
  const W = 1080, H = 1920;
  const font = fontStack();
  const vector = iv || [0, 0, 0, 0, 0, 0];

  let content = backgroundRect(W, H, '#0f172a');

  // Top gradient accent
  const defs = `<linearGradient id="storyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#6366f1"/>
    <stop offset="100%" stop-color="#ec4899"/>
  </linearGradient>`;
  content += `<rect x="0" y="0" width="${W}" height="8" fill="url(#storyGrad)"/>`;

  // Large orbit diagram (top half)
  content += drawOrbit(pcs, 540, 500, 300, { dotRadius: 10, activeColor: '#22c55e', lineColor: '#22c55e' });

  // Title
  const name = chordName || pcs.map(noteName).join(' ');
  content += `<text x="540" y="900" text-anchor="middle" font-family="${font}" font-size="56" font-weight="bold" fill="#f8fafc">${escapeXml(name)}</text>`;

  if (group) {
    content += `<text x="540" y="970" text-anchor="middle" font-family="${font}" font-size="32" fill="#6366f1">${escapeXml(group)}</text>`;
  }

  // Analysis details
  let dy = 1100;
  const details: [string, string][] = [
    ['Pitch Classes', `{${pcs.join(', ')}}`],
    ['Interval Vector', `[${vector.join(', ')}]`],
    ['Stabilizer Order', String(so || 1)],
  ];
  if (mullikenLabel) details.push(['Mulliken Label', mullikenLabel]);

  details.forEach(([label, value]) => {
    content += `<text x="120" y="${dy}" font-family="${font}" font-size="24" fill="#94a3b8">${escapeXml(label)}</text>`;
    content += `<text x="960" y="${dy}" text-anchor="end" font-family="${font}" font-size="24" fill="#f8fafc" font-weight="600">${escapeXml(value)}</text>`;
    dy += 60;
    content += `<line x1="120" y1="${dy - 30}" x2="960" y2="${dy - 30}" stroke="#1e293b" stroke-width="1"/>`;
  });

  // Keyboard at bottom
  content += drawKeyboard(pcs, 90, 1550, 900, 200);

  content += watermark(W - 40, H - 30);
  return svgWrapper(W, H, content, defs);
}

// ─── 18. BANNER (1500x500) ──────────────────────────────────────────────────────

function renderBanner(params: CardParams): string {
  const { pcs, group, chordName, mullikenLabel } = params;
  const W = 1500, H = 500;
  const font = fontStack();

  let content = backgroundRect(W, H, '#0f172a');

  // Left: orbit diagram
  content += drawOrbit(pcs, 250, 250, 160, { dotRadius: 7 });

  // Right: text
  const name = chordName || pcs.map(noteName).join(' ');
  content += `<text x="550" y="200" font-family="${font}" font-size="48" font-weight="bold" fill="#f8fafc">${escapeXml(name)}</text>`;
  if (group) {
    content += `<text x="550" y="260" font-family="${font}" font-size="28" fill="#6366f1">${escapeXml(group)}</text>`;
  }
  if (mullikenLabel) {
    content += `<text x="550" y="310" font-family="${font}" font-size="20" fill="#94a3b8">Mulliken: ${escapeXml(mullikenLabel)}</text>`;
  }

  content += `<text x="550" y="380" font-family="${font}" font-size="16" fill="#64748b">{${pcs.join(', ')}}</text>`;

  // Decorative line
  content += `<line x1="550" y1="145" x2="1400" y2="145" stroke="#1e293b" stroke-width="2"/>`;

  content += watermark(W - 30, H - 20);
  return svgWrapper(W, H, content);
}

// ─── 19. QUOTE ──────────────────────────────────────────────────────────────────

function renderQuote(params: CardParams): string {
  const { pcs, group, chordName, description } = params;
  const W = 1200, H = 630;
  const font = fontStack();

  let content = backgroundRect(W, H, '#111827');

  // Large quote marks
  content += `<text x="80" y="180" font-family="Georgia, serif" font-size="120" fill="#6366f1" opacity="0.3">\u201C</text>`;

  // Generate description from group if not provided
  const quoteText = description || getGroupDescription(group || 'C\u2081');

  // Word-wrap the quote (rough approximation)
  const words = quoteText.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  words.forEach(word => {
    if (currentLine.length + word.length > 45) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  });
  if (currentLine.trim()) lines.push(currentLine.trim());

  lines.slice(0, 4).forEach((line, i) => {
    content += `<text x="160" y="${230 + i * 50}" font-family="Georgia, serif" font-size="32" fill="#f8fafc" font-style="italic">${escapeXml(line)}</text>`;
  });

  // Attribution
  const name = chordName || pcs.map(noteName).join(' ');
  content += `<text x="160" y="500" font-family="${font}" font-size="20" fill="#94a3b8">\u2014 ${escapeXml(name)}${group ? ' (' + escapeXml(group) + ')' : ''}</text>`;

  // Small orbit in corner
  content += drawOrbit(pcs, 1050, 520, 60, { dotRadius: 3, showLabels: false });

  content += watermark(W - 30, H - 20);
  return svgWrapper(W, H, content);
}

function getGroupDescription(group: string): string {
  const descriptions: Record<string, string> = {
    'C\u2081': 'A unique voice, asymmetric and unrepeatable. No transposition leaves this set unchanged.',
    'C\u2082': 'Balanced duality \u2014 this set contains a hidden mirror within its transpositions.',
    'C\u2083': 'Threefold symmetry creates a sense of completeness and cyclical return.',
    'C\u2084': 'Fourfold symmetry \u2014 a diminished architecture dividing the octave equally.',
    'C\u2086': 'Sixfold symmetry \u2014 the whole-tone world, floating without resolution.',
    'D\u2081': 'Inversional symmetry around a single axis \u2014 a mirror through the chromatic circle.',
    'D\u2082': 'Two axes of symmetry create stability and groundedness.',
    'D\u2083': 'Triangular symmetry \u2014 the augmented triad, pointing in three directions at once.',
    'D\u2084': 'The fully diminished chord: four axes, maximum tension, equal division.',
    'D\u2086': 'The whole-tone scale with inversional symmetry \u2014 impressionistic luminosity.',
    'D\u2081\u2082': 'Maximum symmetry \u2014 the chromatic aggregate or its complement. All transformations converge.',
  };
  return descriptions[group] || 'A pitch-class set revealing hidden structural beauty through group-theoretic analysis.';
}

// ─── 20. TIMELINE ───────────────────────────────────────────────────────────────

function renderTimeline(params: CardParams): string {
  const { pcs, group, stabilizerOrder: so, chordName } = params;
  const W = 1200, H = 630;
  const font = fontStack();

  let content = backgroundRect(W, H, '#0f172a');

  content += `<text x="600" y="70" text-anchor="middle" font-family="${font}" font-size="28" font-weight="bold" fill="#f8fafc">Symmetry Profile</text>`;

  // Simulate a timeline sparkline (using the PCS values as data points for visual interest)
  const dataPoints = pcs.length > 0 ? [...pcs, ...pcs.map(p => (p + 3) % 12), ...pcs.map(p => (p + 7) % 12)] : [1, 2, 3, 4, 3, 2, 1];
  const maxDP = Math.max(...dataPoints, 1);
  const graphX = 100, graphY = 120, graphW = 1000, graphH = 300;

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const y = graphY + (i / 4) * graphH;
    content += `<line x1="${graphX}" y1="${y}" x2="${graphX + graphW}" y2="${y}" stroke="#1e293b" stroke-width="1"/>`;
  }

  // Sparkline
  let sparkPath = '';
  dataPoints.forEach((dp, i) => {
    const x = graphX + (i / (dataPoints.length - 1)) * graphW;
    const y = graphY + graphH - (dp / maxDP) * graphH;
    sparkPath += (i === 0 ? 'M' : 'L') + ` ${x} ${y}`;
  });
  content += `<path d="${sparkPath}" fill="none" stroke="#22c55e" stroke-width="3"/>`;

  // Dots
  dataPoints.forEach((dp, i) => {
    const x = graphX + (i / (dataPoints.length - 1)) * graphW;
    const y = graphY + graphH - (dp / maxDP) * graphH;
    content += `<circle cx="${x}" cy="${y}" r="4" fill="#22c55e"/>`;
  });

  // Current position marker
  const currentOrder = so || 1;
  content += `<text x="600" y="490" text-anchor="middle" font-family="${font}" font-size="20" fill="#f8fafc">${escapeXml(chordName || pcs.map(noteName).join(' '))}  \u2022  ${escapeXml(group || 'C\u2081')}  \u2022  Order ${currentOrder}</text>`;

  // Y-axis label
  content += `<text x="60" y="${graphY + graphH / 2}" text-anchor="middle" font-family="${font}" font-size="12" fill="#64748b" transform="rotate(-90, 60, ${graphY + graphH / 2})">Stabilizer</text>`;

  // X-axis label
  content += `<text x="${graphX + graphW / 2}" y="${graphY + graphH + 40}" text-anchor="middle" font-family="${font}" font-size="12" fill="#64748b">Analysis Position</text>`;

  content += watermark(W - 30, H - 20);
  return svgWrapper(W, H, content);
}

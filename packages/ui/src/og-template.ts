/**
 * Server-side OG image generator.
 * Takes an array of pitch classes and returns an SVG markup string
 * suitable for use as an Open Graph image (1200x630).
 */

type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

const WIDTH = 1200;
const HEIGHT = 630;
const CX = 600;
const CY = 370;
const RADIUS = 220;
const DOT_RADIUS = 20;

function pcToXY(pc: PitchClass): [number, number] {
  const angle = (pc * 30 - 90) * (Math.PI / 180);
  return [CX + RADIUS * Math.cos(angle), CY + RADIUS * Math.sin(angle)];
}

export interface OgImageOptions {
  /** Pitch classes to highlight (0-11) */
  selectedPCs: PitchClass[];
  /** Title text (default: "Musical Symmetry") */
  title?: string;
  /** Subtitle text (default: "See the hidden geometry of chords") */
  subtitle?: string;
  /** Inversional axes as pitch-class values (each drawn to its opposite) */
  axes?: number[];
}

export function generateOgSvg(options: OgImageOptions): string {
  const {
    selectedPCs,
    title = 'Musical Symmetry',
    subtitle = 'See the hidden geometry of chords',
    axes = [],
  } = options;

  const allPCs: PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  // Build axis lines
  const axisLines = axes.map(axis => {
    const angle1 = (axis * 30 - 90) * (Math.PI / 180);
    const angle2 = ((axis + 6) * 30 - 90) * (Math.PI / 180);
    const ext = RADIUS + 15;
    const x1 = CX + ext * Math.cos(angle1);
    const y1 = CY + ext * Math.sin(angle1);
    const x2 = CX + ext * Math.cos(angle2);
    const y2 = CY + ext * Math.sin(angle2);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.6"/>`;
  }).join('\n  ');

  // Build polygon
  let polygon = '';
  if (selectedPCs.length >= 3) {
    const points = selectedPCs.map(pc => {
      const [x, y] = pcToXY(pc);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    polygon = `<polygon points="${points}" fill="rgba(34, 197, 94, 0.15)" stroke="#22c55e" stroke-width="2"/>`;
  } else if (selectedPCs.length === 2) {
    const [x1, y1] = pcToXY(selectedPCs[0]!);
    const [x2, y2] = pcToXY(selectedPCs[1]!);
    polygon = `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#22c55e" stroke-width="2"/>`;
  }

  // Build note dots
  const dots = allPCs.map(pc => {
    const [x, y] = pcToXY(pc);
    const isActive = selectedPCs.includes(pc);
    const fill = isActive ? '#22c55e' : '#1f2937';
    const stroke = isActive ? '#16a34a' : '#4b5563';
    const textFill = isActive ? '#ffffff' : '#9ca3af';
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${DOT_RADIUS}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  <text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="14" fill="${textFill}">${NOTE_NAMES[pc]}</text>`;
  }).join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#111827"/>
  <text x="${CX}" y="80" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="48" font-weight="700" fill="#ffffff">${escapeXml(title)}</text>
  <text x="${CX}" y="120" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="24" fill="#9ca3af">${escapeXml(subtitle)}</text>
  <circle cx="${CX}" cy="${CY}" r="${RADIUS}" fill="none" stroke="#374151" stroke-width="1.5"/>
  ${axisLines}
  ${polygon}
  ${dots}
</svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

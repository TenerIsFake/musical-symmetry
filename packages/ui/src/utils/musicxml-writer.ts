/**
 * MusicXML 4.0 generator.
 * Produces valid MusicXML that can be imported by Finale, MuseScore, Sibelius.
 */

export interface MusicXMLNote {
  pitch: number;    // MIDI note number (60 = C4)
  duration: number; // in quarter-note units (1 = quarter, 0.5 = eighth, etc.)
  rest?: boolean;
}

export interface MusicXMLPart {
  name: string;
  notes: MusicXMLNote[];
}

export interface MusicXMLOptions {
  title: string;
  composer?: string;
  tempo: number;
  timeSignature: [number, number]; // [beats, beatType] e.g. [4, 4]
  parts: MusicXMLPart[];
}

// Semitone index → step letter (prefer sharps)
const STEP_MAP = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'] as const;
// 1 = sharp, 0 = natural
const ALTER_MAP = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0] as const;

// Quarter-note duration → MusicXML <type> string
const DURATION_TYPE_MAP: [number, string][] = [
  [4,    'whole'],
  [3,    'half'],    // dotted half — we'll handle as half + dot
  [2,    'half'],
  [1,    'quarter'],
  [0.5,  'eighth'],
  [0.25, '16th'],
  [0.125,'32nd'],
];

function durationToType(quarterUnits: number): { type: string; dot: boolean } {
  for (const [val, name] of DURATION_TYPE_MAP) {
    if (Math.abs(quarterUnits - val) < 1e-6) {
      return { type: name, dot: false };
    }
    // Dotted variant: duration = 1.5 × base
    if (Math.abs(quarterUnits - val * 1.5) < 1e-6) {
      return { type: name, dot: true };
    }
  }
  // Fallback to nearest
  return { type: 'quarter', dot: false };
}

function midiToPitch(midiNote: number): { step: string; alter: number; octave: number } {
  const semitone = midiNote % 12;
  const step = STEP_MAP[semitone]!;
  const alter = ALTER_MAP[semitone]!;
  const octave = Math.floor(midiNote / 12) - 1;
  return { step, alter, octave };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Partition a flat list of notes into bars given a time signature.
 * Returns an array of note arrays, one per bar.
 */
function partitionIntoBars(
  notes: MusicXMLNote[],
  beatsPerBar: number,
): MusicXMLNote[][] {
  const bars: MusicXMLNote[][] = [];
  let currentBarDuration = 0;
  let currentBar: MusicXMLNote[] = [];

  for (const note of notes) {
    let remaining = note.duration;
    while (remaining > 1e-9) {
      const spaceLeft = beatsPerBar - currentBarDuration;
      if (remaining <= spaceLeft + 1e-9) {
        currentBar.push({ ...note, duration: remaining });
        currentBarDuration += remaining;
        remaining = 0;
      } else {
        // Split note across bar boundary
        currentBar.push({ ...note, duration: spaceLeft });
        bars.push(currentBar);
        currentBar = [];
        currentBarDuration = 0;
        remaining -= spaceLeft;
      }
    }
    if (Math.abs(currentBarDuration - beatsPerBar) < 1e-9) {
      bars.push(currentBar);
      currentBar = [];
      currentBarDuration = 0;
    }
  }

  if (currentBar.length > 0) {
    bars.push(currentBar);
  }

  return bars;
}

function renderNote(note: MusicXMLNote, divisions: number): string {
  const durationTicks = Math.round(note.duration * divisions);
  const { type, dot } = durationToType(note.duration);
  const dotXml = dot ? '\n        <dot/>' : '';

  if (note.rest) {
    return [
      '      <note>',
      '        <rest/>',
      `        <duration>${durationTicks}</duration>`,
      `        <type>${type}</type>${dotXml}`,
      '      </note>',
    ].join('\n');
  }

  const { step, alter, octave } = midiToPitch(note.pitch);
  const alterXml = alter !== 0 ? `\n          <alter>${alter}</alter>` : '';

  return [
    '      <note>',
    '        <pitch>',
    `          <step>${step}</step>${alterXml}`,
    `          <octave>${octave}</octave>`,
    '        </pitch>',
    `        <duration>${durationTicks}</duration>`,
    `        <type>${type}</type>${dotXml}`,
    '      </note>',
  ].join('\n');
}

/**
 * Generate valid MusicXML 4.0 from structured options.
 */
export function toMusicXML(options: MusicXMLOptions): string {
  const { title, composer, tempo, timeSignature, parts } = options;
  const [beats, beatType] = timeSignature;
  const divisions = 4; // sixteenth-note resolution

  const partListXml = parts
    .map((p, i) => `    <score-part id="P${i + 1}">\n      <part-name>${escapeXml(p.name)}</part-name>\n    </score-part>`)
    .join('\n');

  const partsXml = parts.map((part, partIdx) => {
    const partId = `P${partIdx + 1}`;
    const bars = partitionIntoBars(part.notes, beats);

    const measuresXml = bars.map((barNotes, measureIdx) => {
      const isFirst = measureIdx === 0;
      const attributesXml = isFirst
        ? [
            '      <attributes>',
            `        <divisions>${divisions}</divisions>`,
            '        <time>',
            `          <beats>${beats}</beats>`,
            `          <beat-type>${beatType}</beat-type>`,
            '        </time>',
            '      </attributes>',
          ].join('\n')
        : '';

      const directionXml = isFirst
        ? [
            '      <direction placement="above">',
            '        <direction-type>',
            '          <metronome>',
            '            <beat-unit>quarter</beat-unit>',
            `            <per-minute>${tempo}</per-minute>`,
            '          </metronome>',
            '        </direction-type>',
            '      </direction>',
          ].join('\n')
        : '';

      const notesXml = barNotes.map(n => renderNote(n, divisions)).join('\n');

      const parts = [
        `    <measure number="${measureIdx + 1}">`,
        attributesXml,
        directionXml,
        notesXml,
        '    </measure>',
      ].filter(Boolean).join('\n');

      return parts;
    }).join('\n');

    return [`  <part id="${partId}">`, measuresXml, '  </part>'].join('\n');
  }).join('\n');

  const composerXml = composer
    ? `  <identification>\n    <creator type="composer">${escapeXml(composer)}</creator>\n  </identification>\n`
    : '';

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="4.0">',
    `  <work><work-title>${escapeXml(title)}</work-title></work>`,
    composerXml.trimEnd(),
    '  <part-list>',
    partListXml,
    '  </part-list>',
    partsXml,
    '</score-partwise>',
  ].filter(Boolean).join('\n');
}

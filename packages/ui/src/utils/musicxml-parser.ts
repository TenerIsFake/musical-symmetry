/**
 * MusicXML parser — uses the browser's DOMParser (no external dependencies).
 */

export interface MusicXMLNote {
  pitch: number;       // MIDI pitch (0–127), -1 for rests
  duration: number;   // raw MusicXML duration value
  isRest: boolean;
}

export interface MusicXMLMeasure {
  number: number;
  notes: MusicXMLNote[];
  pitchClasses: number[];
}

/** Map diatonic step letter → base pitch class */
const STEP_TO_PC: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/**
 * Parse a MusicXML string and return an array of measures with notes
 * and derived pitch-class sets (sorted, unique, mod 12).
 */
export function parseMusicXML(xmlString: string): MusicXMLMeasure[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid XML: ' + (parseError.textContent ?? 'parse error'));
  }

  const measures: MusicXMLMeasure[] = [];
  // Collect measure elements from all <part> elements; deduplicate by number
  const measureMap = new Map<number, MusicXMLMeasure>();

  const partEls = doc.querySelectorAll('part');
  partEls.forEach((partEl) => {
    const measureEls = partEl.querySelectorAll('measure');
    measureEls.forEach((measureEl) => {
      const rawNum = measureEl.getAttribute('number');
      const measureNum = rawNum !== null ? parseInt(rawNum, 10) : NaN;
      if (isNaN(measureNum)) return;

      const notes: MusicXMLNote[] = [];

      const noteEls = measureEl.querySelectorAll('note');
      noteEls.forEach((noteEl) => {
        const isRest = noteEl.querySelector('rest') !== null;
        const durationEl = noteEl.querySelector('duration');
        const duration = durationEl ? parseInt(durationEl.textContent ?? '0', 10) : 0;

        if (isRest) {
          notes.push({ pitch: -1, duration, isRest: true });
          return;
        }

        const pitchEl = noteEl.querySelector('pitch');
        if (!pitchEl) return;

        const stepEl = pitchEl.querySelector('step');
        const octaveEl = pitchEl.querySelector('octave');
        const alterEl = pitchEl.querySelector('alter');

        if (!stepEl || !octaveEl) return;

        const step = (stepEl.textContent ?? '').trim().toUpperCase();
        const octave = parseInt(octaveEl.textContent ?? '4', 10);
        const alter = alterEl ? parseFloat(alterEl.textContent ?? '0') : 0;

        const basePC = STEP_TO_PC[step];
        if (basePC === undefined) return;

        // MIDI pitch: (octave + 1) * 12 + base + alter (rounded)
        const midiPitch = (octave + 1) * 12 + basePC + Math.round(alter);

        notes.push({ pitch: midiPitch, duration, isRest: false });
      });

      // Derive pitch classes: unique, sorted, mod 12, non-rest only
      const pcSet = Array.from(
        new Set(notes.filter((n) => !n.isRest).map((n) => ((n.pitch % 12) + 12) % 12))
      ).sort((a, b) => a - b);

      if (measureMap.has(measureNum)) {
        // Merge notes from multiple parts into the same measure
        const existing = measureMap.get(measureNum)!;
        existing.notes.push(...notes);
        // Re-derive pitch classes after merging
        const mergedPCs = Array.from(
          new Set(
            existing.notes
              .filter((n) => !n.isRest)
              .map((n) => ((n.pitch % 12) + 12) % 12)
          )
        ).sort((a, b) => a - b);
        existing.pitchClasses = mergedPCs;
      } else {
        measureMap.set(measureNum, { number: measureNum, notes, pitchClasses: pcSet });
      }
    });
  });

  // Sort by measure number
  measureMap.forEach((m) => measures.push(m));
  measures.sort((a, b) => a.number - b.number);

  return measures;
}

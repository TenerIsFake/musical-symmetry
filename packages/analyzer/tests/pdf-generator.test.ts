import { describe, it, expect } from 'vitest';
import { generateAnalysisReport } from '../src/reports/pdf-generator.js';
import type { PitchClass } from '@musical-symmetry/core';
import { classify, identifyChord } from '@musical-symmetry/core';

describe('PDF Generator', () => {
  it('returns a Buffer for a simple analysis', async () => {
    const pcs = [0, 4, 7] as PitchClass[];
    const analysis = classify(pcs);
    const chord = identifyChord(pcs);

    const pdf = await generateAnalysisReport({
      title: 'Test Report',
      analyses: [{ analysis, chord, pitchClasses: pcs }],
    });

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(100);
    expect(pdf.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('handles timeline reports with multiple slices', async () => {
    const slices = [
      { analysis: classify([0, 4, 7] as PitchClass[]), chord: identifyChord([0, 4, 7] as PitchClass[]), pitchClasses: [0, 4, 7] as PitchClass[], beat: 0 },
      { analysis: classify([0, 3, 7] as PitchClass[]), chord: identifyChord([0, 3, 7] as PitchClass[]), pitchClasses: [0, 3, 7] as PitchClass[], beat: 1 },
    ];

    const pdf = await generateAnalysisReport({
      title: 'Timeline Report',
      filename: 'test.mid',
      analyses: slices,
    });

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.slice(0, 5).toString()).toBe('%PDF-');
  });
});

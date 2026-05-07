import { Router } from 'express';
import { toCSEG, analyzeContour, contourSimilarity, contourClass } from '@musical-symmetry/core';
import { requireAuth, requireTier, rateLimit } from '../auth/middleware.js';

export const contourRouter = Router();

contourRouter.post('/analyze', rateLimit('contour'), (req, res) => {
  const { notes } = req.body as { notes?: { pc: number; octave: number }[] };
  if (!notes || !Array.isArray(notes) || notes.length < 2) {
    return res.status(400).json({ error: 'Provide at least 2 notes with { pc, octave }' });
  }
  if (notes.length > 256) {
    return res.status(400).json({ error: 'Maximum 256 notes per request' });
  }

  const pitches = notes.map(n => n.octave * 12 + n.pc);
  const analysis = analyzeContour(pitches);
  const cseg = toCSEG(pitches);

  res.json({
    cseg,
    cas: analysis.cas,
    contourClass: contourClass(cseg),
    depth: analysis.depth,
    isPalindrome: analysis.isPalindrome,
    isInversionallySymmetric: analysis.isInversionallySymmetric,
    comMatrix: analysis.comMatrix,
  });
});

contourRouter.post('/compare', rateLimit('contour'), (req, res) => {
  const { melodyA, melodyB } = req.body as {
    melodyA?: { pc: number; octave: number }[];
    melodyB?: { pc: number; octave: number }[];
  };

  if (!melodyA || !melodyB || melodyA.length < 2 || melodyB.length < 2) {
    return res.status(400).json({ error: 'Provide melodyA and melodyB with at least 2 notes each' });
  }

  const pitchesA = melodyA.map(n => n.octave * 12 + n.pc);
  const pitchesB = melodyB.map(n => n.octave * 12 + n.pc);
  const csegA = toCSEG(pitchesA);
  const csegB = toCSEG(pitchesB);

  const analysisA = analyzeContour(pitchesA);
  const analysisB = analyzeContour(pitchesB);

  const similarity = csegA.length === csegB.length ? contourSimilarity(csegA, csegB) : null;

  res.json({
    melodyA: { cseg: csegA, contourClass: contourClass(csegA), depth: analysisA.depth },
    melodyB: { cseg: csegB, contourClass: contourClass(csegB), depth: analysisB.depth },
    similarity,
    sameLengthRequired: csegA.length !== csegB.length,
  });
});

contourRouter.post('/batch', requireAuth, requireTier('research'), rateLimit('contour'), (req, res) => {
  const { melodies } = req.body as { melodies?: { pc: number; octave: number }[][] };
  if (!melodies || !Array.isArray(melodies) || melodies.length < 2) {
    return res.status(400).json({ error: 'Provide at least 2 melodies for batch comparison' });
  }
  if (melodies.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 melodies per batch' });
  }

  const csegs = melodies.map(m => toCSEG(m.map(n => n.octave * 12 + n.pc)));
  const analyses = melodies.map(m => {
    const pitches = m.map(n => n.octave * 12 + n.pc);
    return { cseg: toCSEG(pitches), contourClass: contourClass(toCSEG(pitches)), depth: analyzeContour(pitches).depth };
  });

  const matrix: (number | null)[][] = csegs.map((a, i) =>
    csegs.map((b, j) => {
      if (i === j) return 1;
      if (a.length !== b.length) return null;
      return contourSimilarity(a, b);
    })
  );

  res.json({ analyses, similarityMatrix: matrix });
});

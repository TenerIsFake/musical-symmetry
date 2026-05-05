import { Router } from 'express';
import multer from 'multer';
import { classify, identifyChord, generalizedVoiceLeading } from '@musical-symmetry/core';
import type { PitchClass } from '@musical-symmetry/core';
import { parseMidi } from './parsers/midi.js';
import { parseMusicXml } from './parsers/musicxml.js';
import { analyzeTimeline } from './analyzer.js';
import type { SliceMode } from './types.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const router = Router();

router.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const sliceMode = (req.body.sliceMode as SliceMode) || 'beat';
    const minNotes = parseInt(req.body.minNotes) || 2;
    const filename = req.file.originalname;
    const ext = filename.split('.').pop()?.toLowerCase();

    let notes;
    let temposBPM: number[];
    let timeSignatures: string[];
    let format: 'midi' | 'musicxml' | 'audio';

    if (ext === 'mid' || ext === 'midi') {
      format = 'midi';
      const parsed = parseMidi(req.file.buffer);
      notes = parsed.notes;
      temposBPM = parsed.temposBPM;
      timeSignatures = parsed.timeSignatures;
    } else if (ext === 'xml' || ext === 'musicxml' || ext === 'mxl') {
      format = 'musicxml';
      const xml = req.file.buffer.toString('utf-8');
      const parsed = parseMusicXml(xml);
      notes = parsed.notes;
      temposBPM = parsed.temposBPM;
      timeSignatures = parsed.timeSignatures;
    } else if (ext === 'wav') {
      format = 'audio';
      const { parseWav } = await import('./parsers/wav.js');
      const parsed = parseWav(req.file.buffer);
      notes = parsed.notes;
      temposBPM = parsed.temposBPM;
      timeSignatures = parsed.timeSignatures;
    } else {
      res.status(400).json({ error: `Unsupported file type: .${ext}. Use .mid, .midi, .xml, .musicxml, or .wav` });
      return;
    }

    if (notes.length === 0) {
      res.status(400).json({ error: 'No notes found in file' });
      return;
    }

    const totalBeats = Math.ceil(Math.max(...notes.map(n => n.startBeat + n.durationBeats)));

    const timeline = analyzeTimeline(notes, {
      sliceMode,
      minNotesPerSlice: minNotes,
      totalBeats,
      temposBPM,
      timeSignatures,
      filename,
      format,
    });

    res.json(timeline);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: `Parse error: ${message}` });
  }
});

router.post('/classify', (req, res) => {
  try {
    const { pitchClasses } = req.body;
    if (!Array.isArray(pitchClasses) || pitchClasses.length < 1) {
      res.status(400).json({ error: 'pitchClasses must be a non-empty array of integers 0-11' });
      return;
    }
    const pcs = pitchClasses.map(Number).filter(n => n >= 0 && n <= 11) as PitchClass[];
    if (pcs.length < 2) {
      res.status(400).json({ error: 'Need at least 2 distinct pitch classes' });
      return;
    }

    const analysis = classify(pcs);
    const chord = pcs.length === 3 ? identifyChord(pcs) : null;

    res.json({ analysis, chord });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.post('/classify/batch', (req, res) => {
  try {
    const { sets } = req.body;
    if (!Array.isArray(sets)) {
      res.status(400).json({ error: 'Body must contain a "sets" array' });
      return;
    }
    if (sets.length > 1000) {
      res.status(400).json({ error: 'Maximum 1000 sets per batch request' });
      return;
    }

    const results = sets.map((pcsRaw: number[], index: number) => {
      if (!Array.isArray(pcsRaw) || pcsRaw.length < 2) {
        return { index, error: 'Need at least 2 pitch classes' };
      }
      const pcs = pcsRaw.map(Number).filter(n => n >= 0 && n <= 11) as PitchClass[];
      const analysis = classify(pcs);
      const chord = pcs.length === 3 ? identifyChord(pcs) : null;
      return { index, analysis, chord };
    });

    res.json({ results, count: results.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.post('/voice-leading', (req, res) => {
  try {
    const { from, to } = req.body;
    if (!Array.isArray(from) || !Array.isArray(to)) {
      res.status(400).json({ error: 'Body must contain "from" and "to" arrays of pitch classes' });
      return;
    }
    const a = from.map(Number).filter(n => n >= 0 && n <= 11) as PitchClass[];
    const b = to.map(Number).filter(n => n >= 0 && n <= 11) as PitchClass[];

    if (a.length === 0 || b.length === 0) {
      res.status(400).json({ error: 'Both arrays must be non-empty' });
      return;
    }
    if (a.length > 8 || b.length > 8) {
      res.status(400).json({ error: 'Maximum 8 pitch classes per set (combinatorial explosion)' });
      return;
    }

    const distance = generalizedVoiceLeading(a, b);
    const fromAnalysis = classify(a);
    const toAnalysis = classify(b);

    res.json({ distance, from: fromAnalysis, to: toAnalysis });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'musical-symmetry-analyzer', version: '1.0.0' });
});

router.get('/docs', (_req, res) => {
  res.json({
    name: 'Musical Symmetry API',
    version: '1.0.0',
    endpoints: [
      {
        method: 'POST',
        path: '/api/classify',
        description: 'Classify a single pitch-class set',
        body: { pitchClasses: [0, 4, 7] },
        response: '{ analysis: SymmetryAnalysis, chord: Chord | null }',
      },
      {
        method: 'POST',
        path: '/api/classify/batch',
        description: 'Classify up to 1000 pitch-class sets in one request',
        body: { sets: [[0, 4, 7], [0, 3, 6, 9], [0, 2, 4, 6, 8, 10]] },
        response: '{ results: [...], count: number }',
      },
      {
        method: 'POST',
        path: '/api/voice-leading',
        description: 'Compute minimal voice-leading distance between two sets',
        body: { from: [0, 4, 7], to: [0, 3, 7] },
        response: '{ distance: number, from: SymmetryAnalysis, to: SymmetryAnalysis }',
      },
      {
        method: 'POST',
        path: '/api/analyze',
        description: 'Analyze a MIDI/MusicXML/WAV file for symmetry over time',
        body: 'multipart/form-data with file field + optional sliceMode (beat|measure) + minNotes (default 2)',
        response: '{ filename, totalBeats, slices: [{ slice, analysis, chord, voiceLeadingFromPrev }] }',
      },
      {
        method: 'GET',
        path: '/api/health',
        description: 'Health check',
        response: '{ status: "ok" }',
      },
    ],
  });
});

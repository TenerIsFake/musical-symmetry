import { Router } from 'express';
import multer from 'multer';
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

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'musical-symmetry-analyzer' });
});

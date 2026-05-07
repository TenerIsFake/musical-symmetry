import { Router } from 'express';
import multer from 'multer';
import { requireTier, rateLimit } from '../auth/middleware.js';
import { parseMidi } from '../parsers/midi.js';
import { parseMusicXml } from '../parsers/musicxml.js';
import { analyzeTimeline } from '../analyzer.js';
import { computeCorpusStats } from './stats.js';
import { saveCorpus, listCorpora, getCorpus, deleteCorpus } from './db.js';
import type { SliceMode } from '../types.js';

const ALLOWED_EXTENSIONS = new Set(['mid', 'midi', 'xml', 'musicxml', 'mxl', 'wav']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext && ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Rejected file type: .${ext}`));
    }
  },
});

async function parseUploadedFile(file: Express.Multer.File): Promise<{
  notes: any[];
  temposBPM: number[];
  timeSignatures: string[];
  format: 'midi' | 'musicxml' | 'audio';
  filename: string;
}> {
  const filename = file.originalname;
  const ext = filename.split('.').pop()?.toLowerCase();

  if (ext === 'mid' || ext === 'midi') {
    const parsed = parseMidi(file.buffer);
    return { ...parsed, format: 'midi', filename };
  } else if (ext === 'xml' || ext === 'musicxml' || ext === 'mxl') {
    const xml = file.buffer.toString('utf-8');
    const parsed = parseMusicXml(xml);
    return { ...parsed, format: 'musicxml', filename };
  } else if (ext === 'wav') {
    const { parseWav } = await import('../parsers/wav.js');
    const parsed = parseWav(file.buffer);
    return { ...parsed, format: 'audio', filename };
  }
  throw new Error(`Unsupported file type: .${ext}`);
}

export const corpusRouter = Router();

// POST /api/corpus/analyze — batch analyze multiple files, compute corpus stats
corpusRouter.post(
  '/analyze',
  requireTier('research'),
  rateLimit('corpus'),
  upload.array('files', 100),
  async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files uploaded' });
        return;
      }

      const name: string = (req.body.name as string)?.trim() || `Corpus ${new Date().toISOString().slice(0, 10)}`;
      const rawSliceMode = req.body.sliceMode as string;
      const sliceMode: SliceMode = rawSliceMode === 'measure' ? 'measure' : 'beat';
      const minNotes = Math.max(1, Math.min(12, parseInt(req.body.minNotes) || 2));

      const timelines: Array<{ filename: string; slices: any[] }> = [];
      const errors: Array<{ filename: string; error: string }> = [];

      for (const file of files) {
        try {
          const { notes, temposBPM, timeSignatures, format, filename } =
            await parseUploadedFile(file);

          if (notes.length === 0) {
            errors.push({ filename: file.originalname, error: 'No notes found' });
            continue;
          }

          const totalBeats = Math.ceil(
            Math.max(...notes.map((n: any) => n.startBeat + n.durationBeats)),
          );

          const timeline = analyzeTimeline(notes, {
            sliceMode,
            minNotesPerSlice: minNotes,
            totalBeats,
            temposBPM,
            timeSignatures,
            filename,
            format,
          });

          timelines.push({ filename, slices: timeline.slices });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          errors.push({
            filename: file.originalname,
            error: message.slice(0, 200).replace(/\/[^\s]+/g, '[path]'),
          });
        }
      }

      if (timelines.length === 0) {
        res.status(400).json({ error: 'No files could be parsed', errors });
        return;
      }

      const stats = computeCorpusStats(timelines);

      // Save to DB if user is authenticated
      let corpusId: number | null = null;
      const userId = (req as any).user?.id;
      if (userId) {
        corpusId = saveCorpus(userId, name, timelines.length, stats);
      }

      res.json({ corpusId, name, stats, errors: errors.length > 0 ? errors : undefined });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: `Corpus analysis error: ${message.slice(0, 200)}` });
    }
  },
);

// GET /api/corpus/compare — compare two saved corpora
corpusRouter.get(
  '/compare',
  requireTier('research'),
  (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const aId = parseInt(req.query.a as string);
    const bId = parseInt(req.query.b as string);

    if (!aId || !bId) {
      res.status(400).json({ error: 'Query params "a" and "b" (corpus IDs) are required' });
      return;
    }

    const corpusA = getCorpus(aId, userId);
    const corpusB = getCorpus(bId, userId);

    if (!corpusA) {
      res.status(404).json({ error: `Corpus ${aId} not found` });
      return;
    }
    if (!corpusB) {
      res.status(404).json({ error: `Corpus ${bId} not found` });
      return;
    }

    res.json({ a: corpusA, b: corpusB });
  },
);

// GET /api/corpus — list all saved corpora for user
corpusRouter.get(
  '/',
  requireTier('research'),
  (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const corpora = listCorpora(userId);
    res.json({ corpora });
  },
);

// GET /api/corpus/:id — get single corpus with full stats
corpusRouter.get(
  '/:id',
  requireTier('research'),
  (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const id = parseInt(req.params.id);
    const corpus = getCorpus(id, userId);
    if (!corpus) {
      res.status(404).json({ error: 'Corpus not found' });
      return;
    }
    res.json(corpus);
  },
);

// DELETE /api/corpus/:id — delete a corpus
corpusRouter.delete(
  '/:id',
  requireTier('research'),
  (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const id = parseInt(req.params.id);
    const deleted = deleteCorpus(id, userId);
    if (!deleted) {
      res.status(404).json({ error: 'Corpus not found' });
      return;
    }
    res.json({ success: true });
  },
);

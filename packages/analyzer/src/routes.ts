import { Router } from 'express';
import multer from 'multer';
import { classify, identifyChord, generalizedVoiceLeading } from '@musical-symmetry/core';
import type { PitchClass } from '@musical-symmetry/core';
import { parseMidi } from './parsers/midi.js';
import { parseMusicXml } from './parsers/musicxml.js';
import { analyzeTimeline } from './analyzer.js';
import type { SliceMode } from './types.js';
import { renderCard } from './cards/renderer.js';
import type { CardStyle } from './cards/types.js';
import { rateLimit } from './auth/middleware.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const router = Router();

router.post('/analyze', upload.single('file'), rateLimit('analyze'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const rawSliceMode = req.body.sliceMode as string;
    const sliceMode: SliceMode = rawSliceMode === 'measure' ? 'measure' : 'beat';
    const minNotes = Math.max(1, Math.min(12, parseInt(req.body.minNotes) || 2));
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
    const safeMessage = message.length > 200 ? message.slice(0, 200) : message;
    res.status(500).json({ error: `Parse error: ${safeMessage.replace(/\/[^\s]+/g, '[path]')}` });
  }
});

router.post('/classify', rateLimit('classify'), (req, res) => {
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

router.post('/classify/batch', rateLimit('batch'), (req, res) => {
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

const VALID_STYLES: CardStyle[] = [
  'orbit', 'identity', 'spectrum', 'comparison', 'keyboard', 'molecule',
  'interval-dna', 'tonnetz', 'gradient', 'minimal', 'academic', 'neon',
  'blueprint', 'constellation', 'waveform', 'badge', 'story', 'banner',
  'quote', 'timeline',
];

router.get('/og/:style', rateLimit('og'), (req, res) => {
  try {
    const style = req.params.style as CardStyle;
    if (!VALID_STYLES.includes(style)) {
      res.status(400).json({ error: `Invalid style. Valid styles: ${VALID_STYLES.join(', ')}` });
      return;
    }

    const pcsParam = req.query.pcs as string;
    if (!pcsParam) {
      res.status(400).json({ error: 'Missing required query param: pcs (comma-separated pitch classes 0-11)' });
      return;
    }

    const pcs = pcsParam.split(',').map(Number).filter(n => n >= 0 && n <= 11);
    if (pcs.length < 1) {
      res.status(400).json({ error: 'Need at least 1 pitch class' });
      return;
    }

    // Optional: run analysis to enrich params
    const validPcs = pcs as PitchClass[];
    let group: string | undefined;
    let stabilizerOrder: number | undefined;
    let mullikenLabel: string | undefined;
    let intervalVector: [number, number, number, number, number, number] | undefined;
    let chordName: string | undefined;

    if (validPcs.length >= 2) {
      const analysis = classify(validPcs);
      group = analysis.abstractGroup;
      stabilizerOrder = analysis.stabilizerOrder;
      mullikenLabel = analysis.mullikenLabel;
      intervalVector = analysis.intervalVector;

      if (validPcs.length === 3) {
        const chord = identifyChord(validPcs);
        if (chord) {
          const noteNames: Record<number, string> = { 0:'C', 1:'C#', 2:'D', 3:'Eb', 4:'E', 5:'F', 6:'F#', 7:'G', 8:'Ab', 9:'A', 10:'Bb', 11:'B' };
          chordName = `${noteNames[chord.root]} ${chord.quality}`;
        }
      }
    }

    const comparePcsParam = req.query.comparePcs as string | undefined;
    const comparePcs = comparePcsParam
      ? comparePcsParam.split(',').map(Number).filter(n => n >= 0 && n <= 11)
      : undefined;

    const vlDistParam = req.query.vlDistance as string | undefined;
    const vlDistance = vlDistParam ? parseInt(vlDistParam) : undefined;

    const svg = renderCard(style, {
      pcs,
      comparePcs,
      title: (req.query.title as string) || undefined,
      subtitle: (req.query.subtitle as string) || undefined,
      group: (req.query.group as string) || group,
      chordName: (req.query.chordName as string) || chordName,
      forteNumber: (req.query.forteNumber as string) || undefined,
      vlDistance,
      genre: (req.query.genre as string) || undefined,
      stabilizerOrder,
      mullikenLabel,
      intervalVector,
      description: (req.query.description as string) || undefined,
    });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(svg);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

const CRAWLER_UA = /facebookexternalhit|Twitterbot|Discordbot|LinkedInBot|Slackbot|WhatsApp/i;

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

router.get('/share/:style', (req, res) => {
  try {
    const style = req.params.style as CardStyle;
    if (!VALID_STYLES.includes(style)) {
      res.status(400).send('Invalid style');
      return;
    }

    const pcs = (req.query.pcs as string) || '0,4,7';
    const pcsArr = pcs.split(',').map(Number).filter(n => n >= 0 && n <= 11) as PitchClass[];

    let chordName = `{${pcs}}`;
    let group = '';
    if (pcsArr.length >= 2) {
      const analysis = classify(pcsArr);
      group = analysis.abstractGroup;
      if (pcsArr.length === 3) {
        const chord = identifyChord(pcsArr);
        if (chord) {
          const noteNames: Record<number, string> = {
            0: 'C', 1: 'C#', 2: 'D', 3: 'Eb', 4: 'E', 5: 'F',
            6: 'F#', 7: 'G', 8: 'Ab', 9: 'A', 10: 'Bb', 11: 'B',
          };
          chordName = `${noteNames[chord.root]} ${chord.quality}`;
        }
      }
    }

    const ogImageUrl = `https://symmetry.tendrid.us/api/og/${style}?pcs=${encodeURIComponent(pcs)}`;
    const appUrl = `https://symmetry.tendrid.us/#classifier?pcs=${encodeURIComponent(pcs)}`;
    const title = group ? `${chordName} — ${group} symmetry` : chordName;
    const description = `Discover the hidden geometry of ${chordName}. Musical Symmetry uses group theory to reveal the structure behind every chord.`;

    const isCrawler = CRAWLER_UA.test(req.get('user-agent') || '');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(appUrl)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
  <title>${escapeHtml(title)} — Musical Symmetry</title>
  ${isCrawler ? '' : `<meta http-equiv="refresh" content="0;url=${escapeHtml(appUrl)}" />`}
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(appUrl)}">Musical Symmetry</a>...</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send('Internal server error');
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

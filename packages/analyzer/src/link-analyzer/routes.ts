import { Router } from 'express';
import { rateLimit } from '../auth/middleware.js';
import { fetchAudioFromUrl } from './fetcher.js';
import { parseWav } from '../parsers/wav.js';
import { analyzeTimeline } from '../analyzer.js';

export const linkAnalyzerRouter = Router();

function sendSseEvent(res: import('express').Response, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

linkAnalyzerRouter.post('/', rateLimit('link-analyze'), (req, res) => {
  const { url } = req.body as { url?: string };

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing or invalid url in request body' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  (async () => {
    try {
      sendSseEvent(res, { type: 'progress', message: 'Fetching audio...' });

      const audioBuffer = await fetchAudioFromUrl(url, (msg) => {
        sendSseEvent(res, { type: 'progress', message: msg });
      });

      sendSseEvent(res, { type: 'progress', message: 'Analyzing...' });

      const parsed = parseWav(audioBuffer);

      const urlObj = new URL(url);
      const filename = urlObj.hostname.replace(/^www\./, '') + urlObj.pathname.split('/').pop();

      const timeline = analyzeTimeline(parsed.notes, {
        sliceMode: 'beat',
        minNotesPerSlice: 2,
        totalBeats: Math.ceil(parsed.durationSeconds * (parsed.temposBPM[0] ?? 120) / 60),
        temposBPM: parsed.temposBPM,
        timeSignatures: parsed.timeSignatures,
        filename: filename || 'audio',
        format: 'audio',
      });

      sendSseEvent(res, { type: 'result', data: timeline });
      res.end();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      sendSseEvent(res, { type: 'error', message });
      res.end();
    }
  })();
});

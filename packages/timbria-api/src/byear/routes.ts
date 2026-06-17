import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import type { FxCategory } from '../types.js';
import type { EarInfer } from './ear-infer.js';
import { normalizeAudio, AudioError } from './audio-normalize.js';
import { mapEffectsToFxTypeIds } from './fx-mapper.js';
import type { ByEarResponse } from './types.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

async function handleByEar(
  req: Request,
  res: Response,
  ear: EarInfer,
  resolveFxIdsByCategory: (cat: FxCategory) => number[],
): Promise<Response> {
  if (!req.file) return res.status(400).json({ error: 'no clip uploaded (field "clip")' });
  let norm;
  try {
    norm = await normalizeAudio(req.file.buffer);
  } catch (e) {
    if (e instanceof AudioError) return res.status(400).json({ error: e.message });
    throw e;
  }
  const domain = 'isolated' as const;
  const result = await ear.infer(norm.pcm, domain);
  const fxTypeIds = mapEffectsToFxTypeIds(result.effects, resolveFxIdsByCategory);
  const body: ByEarResponse = { domain, ...result, fxTypeIds };
  return res.json(body);
}

export function makeByEarRouter(
  ear: EarInfer,
  resolveFxIdsByCategory: (cat: FxCategory) => number[],
): Router {
  const r = Router();
  r.post('/by-ear', upload.single('clip'), (req: Request, res: Response, next: NextFunction) => {
    handleByEar(req, res, ear, resolveFxIdsByCategory).catch(next);
  });
  return r;
}

import type { EarInfer } from './ear-infer.js';
import { StubEarInfer } from './ear-infer.js';
import { HttpEarInfer } from './http-ear-infer.js';
import { ResilientEarInfer } from './resilient-ear-infer.js';

export function buildEarInfer(env: Record<string, string | undefined> = process.env): EarInfer {
  const url = env.EAR_INFER_URL;
  if (!url) return new StubEarInfer();
  return new ResilientEarInfer(new HttpEarInfer(url), new StubEarInfer());
}

import type { Confidence } from '../types.js';

export interface ParsedGear { gear_item_id: number; context: string; source_url: string; confidence: Confidence; }
const VALID: Confidence[] = ['low', 'med', 'high'];

export function parseLookup(raw: string, gearIndex: Map<string, number>): ParsedGear[] {
  let data: any;
  try { data = JSON.parse(raw); } catch { return []; }
  const rows = Array.isArray(data?.gear) ? data.gear : [];
  const out: ParsedGear[] = [];
  for (const row of rows) {
    const src = typeof row?.source_url === 'string' ? row.source_url.trim() : '';
    if (!/^https?:\/\//.test(src)) continue;                 // drop uncited
    const gearId = gearIndex.get(String(row?.gear ?? '').toLowerCase().trim());
    if (!gearId) continue;                                   // drop unmappable
    // invalid/absent confidence clamps to 'high' (a cited claim is corroborated
    // by >=1 source); switch this default to 'low' if you prefer conservative.
    const confidence: Confidence = VALID.includes(row?.confidence) ? row.confidence : 'high';
    out.push({ gear_item_id: gearId, context: String(row?.context ?? '').slice(0, 120), source_url: src, confidence });
  }
  return out;
}

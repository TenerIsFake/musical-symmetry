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
    if (!/^https?:\/\//i.test(src)) continue;                // drop uncited
    if (typeof row?.gear !== 'string') continue;             // gear must be a string
    const gearId = gearIndex.get(row.gear.toLowerCase().trim());
    if (gearId === undefined) continue;                      // drop unmappable
    // invalid/absent confidence defaults to 'low' — unverified extracted data
    // should not claim high confidence; only an explicit valid value is honored.
    const confidence: Confidence = VALID.includes(row?.confidence) ? row.confidence : 'low';
    out.push({ gear_item_id: gearId, context: String(row?.context ?? '').slice(0, 120), source_url: src, confidence });
  }
  return out;
}

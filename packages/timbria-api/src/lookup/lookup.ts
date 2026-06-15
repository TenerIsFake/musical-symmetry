import { parseLookup, type ParsedGear } from './parse.js';

export interface LookupDeps {
  webSearch: (query: string) => Promise<string>;
  llm: (prompt: string) => Promise<string>;
  timeoutMs: number;
}

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

export async function runLookup(artist: string, gearIndex: Map<string, number>, deps: LookupDeps): Promise<ParsedGear[]> {
  try {
    const evidence = await withTimeout(deps.webSearch(`${artist} studio gear equipment signal chain`), deps.timeoutMs);
    const prompt = `From the following sources about ${artist}, extract studio gear as JSON ` +
      `{"gear":[{"gear","context","source_url","confidence":"low|med|high"}]}. ` +
      `Only include items with a real source_url from the text. Sources:\n${evidence}`;
    const raw = await withTimeout(deps.llm(prompt), deps.timeoutMs);
    return parseLookup(raw, gearIndex);
  } catch {
    return [];
  }
}

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
    // Catalog-aware extraction: parseLookup maps gear by EXACT lowercased name, so
    // tell the model to map findings onto the known catalog vocabulary (the keys of
    // gearIndex) and drop anything not in it. Without this, free-form names rarely
    // match and the lookup returns nothing on a small catalog.
    const catalog = [...gearIndex.keys()];
    const catalogHint = catalog.length
      ? ` Use ONLY these exact gear names (case-insensitive) when an item matches one; ` +
        `drop findings that don't match one: ${JSON.stringify(catalog)}.`
      : '';
    const prompt = `From the following sources about ${artist}, extract studio gear as JSON ` +
      `{"gear":[{"gear","context","source_url","confidence":"low|med|high"}]}. ` +
      `Only include items with a real source_url from the text.${catalogHint} Sources:\n${evidence}`;
    const raw = await withTimeout(deps.llm(prompt), deps.timeoutMs);
    return parseLookup(raw, gearIndex);
  } catch {
    return [];
  }
}

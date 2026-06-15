// Gemini-backed production seams for the artist gear lookup (Feature B slice 3).
//
// The spec's design is "web search -> LLM structures findings with source URLs".
// Gemini's `google_search` grounding does the search AND returns citation URLs in
// one call, so both seams (webSearch + llm) are backed by Gemini:
//   - geminiGroundedSearch : grounded query -> evidence text + SOURCES list
//   - geminiExtractJson     : evidence -> strict-JSON gear list (responseMimeType)
//
// These hit the network and are wired only in index.ts (excluded from CI, like the
// previous Anthropic seam). `formatGroundedResult` is pure and unit-tested.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-2.5-flash'; // pinned: 2.0-flash was retired; alias risks behaviour drift

// Pure: shape a Gemini generateContent (grounded) response into evidence text.
// Appends a SOURCES block of the http(s) grounding URLs so the extraction step
// has real citations to attach (parseLookup drops any gear lacking one).
export function formatGroundedResult(resp: unknown): string {
  const r = resp as any;
  const cand = r?.candidates?.[0] ?? {};
  const text: string = (cand.content?.parts ?? [])
    .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
    .join('');
  const chunks = cand.groundingMetadata?.groundingChunks ?? [];
  const sources: string[] = chunks
    .map((c: any) => c?.web?.uri)
    .filter((u: any) => typeof u === 'string' && /^https?:\/\//.test(u));
  const uniqueSources = [...new Set(sources)];
  const block = uniqueSources.length
    ? '\n\nSOURCES:\n' + uniqueSources.map((u) => `- ${u}`).join('\n')
    : '';
  return text + block;
}

async function postGemini(apiKey: string, body: unknown): Promise<any> {
  const res = await fetch(`${GEMINI_BASE}/${MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// Seam 1: grounded web search. Returns evidence text + cited source URLs.
export async function geminiGroundedSearch(query: string, apiKey: string): Promise<string> {
  const resp = await postGemini(apiKey, {
    contents: [{ parts: [{ text:
      `Research the studio gear, instruments, microphones, and outboard/processing ` +
      `used by ${query}. Name specific, real units and who/what each was used on.` }] }],
    tools: [{ google_search: {} }],
  });
  return formatGroundedResult(resp);
}

// Seam 2: structure evidence into the strict JSON parseLookup expects.
export async function geminiExtractJson(prompt: string, apiKey: string): Promise<string> {
  const resp = await postGemini(apiKey, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  });
  return (resp?.candidates?.[0]?.content?.parts ?? [])
    .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
    .join('');
}

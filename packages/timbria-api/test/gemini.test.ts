import { describe, it, expect } from 'vitest';
import { formatGroundedResult } from '../src/lookup/gemini.js';

describe('formatGroundedResult', () => {
  const resp = (parts: any[], chunks: any[]) => ({
    candidates: [{ content: { parts }, groundingMetadata: { groundingChunks: chunks } }],
  });

  it('joins text and appends an http(s) SOURCES block', () => {
    const out = formatGroundedResult(resp(
      [{ text: 'Used an ' }, { text: 'EMT 140 plate.' }],
      [{ web: { uri: 'https://a.com/1', title: 'a' } }, { web: { uri: 'https://b.com/2' } }],
    ));
    expect(out).toContain('Used an EMT 140 plate.');
    expect(out).toContain('SOURCES:');
    expect(out).toContain('- https://a.com/1');
    expect(out).toContain('- https://b.com/2');
  });

  it('drops non-http source uris and de-dupes', () => {
    const out = formatGroundedResult(resp(
      [{ text: 'text' }],
      [{ web: { uri: 'ftp://x' } }, { web: { uri: 'https://a.com' } }, { web: { uri: 'https://a.com' } }],
    ));
    expect(out).toContain('https://a.com');
    expect(out).not.toContain('ftp://x');
    // only one occurrence of the deduped url in the SOURCES list
    expect(out.split('- https://a.com').length).toBe(2);
  });

  it('returns just the text (no SOURCES block) when there are no grounding urls', () => {
    expect(formatGroundedResult(resp([{ text: 'hello' }], []))).toBe('hello');
  });

  it('handles malformed/empty responses without throwing', () => {
    expect(formatGroundedResult({})).toBe('');
    expect(formatGroundedResult(null)).toBe('');
  });
});

import { describe, it, expect } from 'vitest';
import { kiwixWikiUrl } from '../wiki';

describe('kiwixWikiUrl', () => {
  it('builds a book-scoped Kiwix search url', () => {
    const u = kiwixWikiUrl('Fender Twin Reverb');
    expect(u).toMatch(/\/search\?books\.id=/);
    expect(u).toContain('pattern=Fender%20Twin%20Reverb');
  });

  it('URL-encodes the pattern (spaces, special chars)', () => {
    expect(kiwixWikiUrl('FET Compressor (1176-style)')).toContain('pattern=FET%20Compressor%20(1176-style)');
    expect(kiwixWikiUrl('AKG C12 & U47')).toContain('pattern=AKG%20C12%20%26%20U47');
  });
});

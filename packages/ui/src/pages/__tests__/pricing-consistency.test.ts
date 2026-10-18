/**
 * Every page that states a tier's price must state the SAME price as the
 * checkout button that charges it.
 *
 * The landing page advertised $9/$29 a month while checkout charged $7/$15,
 * and after the landing page was fixed the API docs table still said $9/$29.
 * Each page was internally fine; only reading them side by side showed the
 * site advertising prices it does not charge. The checkout labels in
 * `DashboardPage` are the reference because they sit next to the Stripe call
 * (live Stripe prices verified 2026-10-18: Pro 700, Research 1500 USD/month).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const pages = join(__dirname, '..');
const read = (name: string) => readFileSync(join(pages, name), 'utf8');

function checkoutPrice(tier: string): string {
  const m = read('DashboardPage.tsx').match(new RegExp(`Upgrade to ${tier} — (\\$\\d+)/mo`));
  if (!m) throw new Error(`no checkout label for ${tier} in DashboardPage.tsx`);
  return m[1];
}

function landingPrice(tier: string): string {
  const src = read('LandingPage.tsx');
  const at = src.indexOf(`>${tier}</h3>`);
  if (at < 0) throw new Error(`no ${tier} card in LandingPage.tsx`);
  const m = src.slice(at).match(/(\$\d+)<span[^>]*>\/mo</);
  if (!m) throw new Error(`no monthly price after the ${tier} card heading`);
  return m[1];
}

function apiDocsPrice(tier: string): string {
  const m = read('ApiDocsPage.tsx').match(new RegExp(`name: '${tier}'[^}]*price: '(\\$\\d+)/mo'`));
  if (!m) throw new Error(`no ${tier} row in the ApiDocsPage tier table`);
  return m[1];
}

describe.each(['Pro', 'Research'])('%s price', (tier) => {
  it('matches checkout on the landing page', () => {
    expect(landingPrice(tier)).toBe(checkoutPrice(tier));
  });

  it('matches checkout in the API docs tier table', () => {
    expect(apiDocsPrice(tier)).toBe(checkoutPrice(tier));
  });
});

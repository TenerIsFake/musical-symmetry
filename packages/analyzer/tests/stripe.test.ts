import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Stripe billing', () => {
  it('returns null when STRIPE_SECRET_KEY is not set', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { createCheckoutUrl } = await import('../src/auth/stripe.js');
    const result = await createCheckoutUrl('user123', 'pro', 'test@example.com');
    expect(result).toBeNull();
  });

  it('validates tier parameter', async () => {
    const { isValidTier } = await import('../src/auth/stripe.js');
    expect(isValidTier('pro')).toBe(true);
    expect(isValidTier('research')).toBe(true);
    expect(isValidTier('admin')).toBe(false);
    expect(isValidTier('')).toBe(false);
  });
});

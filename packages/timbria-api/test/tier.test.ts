import { describe, it, expect } from 'vitest';
import { makeTierResolver } from '../src/auth/tier.js';

describe('tier resolver', () => {
  const resolve = makeTierResolver({
    ownerEmail: 'owner@x.com',
    fetchEntitlements: async (email) => email === 'pro@x.com' ? ['pro'] : [],
  });
  it('owner is research', async () => expect(await resolve('owner@x.com')).toBe('research'));
  it('maps entitlement', async () => expect(await resolve('pro@x.com')).toBe('pro'));
  it('defaults to free', async () => expect(await resolve('nobody@x.com')).toBe('free'));
  it('null email is free', async () => expect(await resolve(null)).toBe('free'));
});

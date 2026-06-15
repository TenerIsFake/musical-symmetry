import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';

describe('health', () => {
  it('GET /healthcheck returns ok', async () => {
    const res = await request(createApp()).get('/healthcheck');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from './app.js';

describe('health check', () => {
  const app = buildApp();
  afterAll(() => app.close());

  it('returns ok status', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});

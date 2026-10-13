import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

describe('auth routes', () => {
  const app = buildApp();

  beforeEach(async () => {
    await prisma.enrollment.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.module.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('registers a new user and returns a token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'test@example.com', password: 'sifre123', name: 'Test Kullanıcı' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user.email).toBe('test@example.com');
    expect(body.user.role).toBe('STUDENT');
    expect(typeof body.token).toBe('string');
  });

  it('rejects duplicate email registration', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'dup@example.com', password: 'sifre123', name: 'Birinci' },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'dup@example.com', password: 'baskasifre', name: 'İkinci' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('EMAIL_TAKEN');
  });

  it('logs in with correct credentials', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'login@example.com', password: 'sifre123', name: 'Giriş Testi' },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'login@example.com', password: 'sifre123' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().user.email).toBe('login@example.com');
  });

  it('rejects login with wrong password using a generic error', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'wrongpw@example.com', password: 'sifre123', name: 'Kullanıcı' },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'wrongpw@example.com', password: 'yanlis' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects login for a nonexistent email with the same generic error', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'yok@example.com', password: 'herhangi' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns the current user for GET /me with a valid token', async () => {
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'me@example.com', password: 'sifre123', name: 'Ben' },
    });
    const { token } = registerResponse.json();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().user.email).toBe('me@example.com');
  });
});

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

describe('user routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

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

  async function registerUser() {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'profile@example.com', password: 'sifre123', name: 'Profil Kullanıcı' },
    });
    return response.json().token as string;
  }

  it('updates the current user with a partial body', async () => {
    const token = await registerUser();
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Yeni İsim' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user.name).toBe('Yeni İsim');
    expect(body.user.email).toBe('profile@example.com');
  });

  it('rejects unauthenticated requests', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      payload: { name: 'Herhangi' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  it('allows clearing avatarUrl by setting it to null', async () => {
    const token = await registerUser();
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { avatarUrl: 'https://example.com/avatar.png' },
    });
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { avatarUrl: null },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().user.avatarUrl).toBeNull();
  });
});

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

describe('auth routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await prisma.enrollment.deleteMany();
    await prisma.lessonProgress.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.module.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const validPayload = {
    email: 'register@example.com',
    password: 'sifre123',
    name: 'Kayıt Kullanıcı',
  };

  describe('POST /api/v1/auth/register', () => {
    it('registers a user and returns a token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: validPayload,
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.token).toBeTypeOf('string');
      expect(body.user.email).toBe(validPayload.email);
    });

    it('rejects a duplicate email', async () => {
      await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: validPayload });
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: validPayload,
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('EMAIL_TAKEN');
    });

    it('rejects an invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { ...validPayload, email: 'not-an-email' },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('INVALID_EMAIL');
    });

    it('rejects a short password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { ...validPayload, password: 'short' },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('WEAK_PASSWORD');
    });

    it('rejects an empty/whitespace name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { ...validPayload, name: '   ' },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('INVALID_NAME');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in with correct credentials', async () => {
      await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: validPayload });
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: validPayload.email, password: validPayload.password },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.token).toBeTypeOf('string');
      expect(body.user.email).toBe(validPayload.email);
    });

    it('rejects an incorrect password', async () => {
      await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: validPayload });
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: validPayload.email, password: 'wrongpassword' },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('INVALID_CREDENTIALS');
    });
  });
});

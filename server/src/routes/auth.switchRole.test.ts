import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../lib/jwt.js';

describe('POST /api/v1/auth/switch-role', () => {
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

  async function createMultiRoleUser() {
    const passwordHash = await bcrypt.hash('sifre123', 12);
    await prisma.user.create({
      data: {
        email: 'multi@example.com',
        passwordHash,
        name: 'Çoklu Rol',
        role: 'STUDENT',
        roles: 'STUDENT,ADMIN',
      },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'multi@example.com', password: 'sifre123' },
    });
    return login.json().token as string;
  }

  it('switches to a role the user holds and returns a new valid token', async () => {
    const token = await createMultiRoleUser();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/switch-role',
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'ADMIN' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user.role).toBe('ADMIN');
    expect(body.user.roles).toEqual(expect.arrayContaining(['STUDENT', 'ADMIN']));

    const decoded = verifyToken(body.token);
    expect(decoded.role).toBe('ADMIN');
    expect(decoded.roles).toEqual(expect.arrayContaining(['STUDENT', 'ADMIN']));
  });

  it('rejects switching to a role the user does not hold', async () => {
    const token = await createMultiRoleUser();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/switch-role',
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'INSTRUCTOR' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ROLE_NOT_ASSIGNED');
  });

  it('rejects unauthenticated requests', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/switch-role',
      payload: { role: 'ADMIN' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });
});

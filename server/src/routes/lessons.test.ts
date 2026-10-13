import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

describe('lesson routes', () => {
  let app: FastifyInstance;
  let instructorToken: string;
  let moduleId: string;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await prisma.enrollment.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.module.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await bcrypt.hash('sifre123', 12);
    const instructor = await prisma.user.create({
      data: { email: 'instructor@example.com', passwordHash, name: 'Eğitmen', role: 'INSTRUCTOR' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'instructor@example.com', password: 'sifre123' },
    });
    instructorToken = login.json().token;

    const course = await prisma.course.create({
      data: {
        title: 'Kurs',
        description: 'Açıklama',
        category: 'Test',
        level: 'Başlangıç',
        accessMode: 'SEQUENTIAL',
        status: 'PUBLISHED',
        instructorId: instructor.id,
      },
    });
    const module = await prisma.module.create({ data: { courseId: course.id, title: 'Modül', order: 1 } });
    moduleId = module.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates a lesson under a module', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/modules/${moduleId}/lessons`,
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: { title: 'Ders 1', order: 1, status: 'DRAFT' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().lesson.moduleId).toBe(moduleId);
  });

  it('returns lessons in order when the course is fetched', async () => {
    await prisma.lesson.create({ data: { moduleId, title: 'İkinci Ders', order: 2, status: 'PUBLISHED' } });
    await prisma.lesson.create({ data: { moduleId, title: 'Birinci Ders', order: 1, status: 'PUBLISHED' } });
    const module = await prisma.module.findUniqueOrThrow({ where: { id: moduleId } });
    const response = await app.inject({ method: 'GET', url: `/api/v1/courses/${module.courseId}` });
    const lessons = response.json().course.modules[0].lessons;
    expect(lessons.map((l: { title: string }) => l.title)).toEqual(['Birinci Ders', 'İkinci Ders']);
  });

  it('rejects an instructor who does not own the course', async () => {
    const passwordHash = await bcrypt.hash('sifre123', 12);
    await prisma.user.create({
      data: { email: 'other@example.com', passwordHash, name: 'Diğer Eğitmen', role: 'INSTRUCTOR' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'other@example.com', password: 'sifre123' },
    });
    const otherToken = login.json().token;
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/modules/${moduleId}/lessons`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { title: 'Ders 1', order: 1, status: 'DRAFT' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('allows an admin to add a lesson to any module', async () => {
    const passwordHash = await bcrypt.hash('sifre123', 12);
    await prisma.user.create({
      data: { email: 'admin@example.com', passwordHash, name: 'Yönetici', role: 'ADMIN' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@example.com', password: 'sifre123' },
    });
    const adminToken = login.json().token;
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/modules/${moduleId}/lessons`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { title: 'Ders 1', order: 1, status: 'DRAFT' },
    });
    expect(response.statusCode).toBe(201);
  });
});

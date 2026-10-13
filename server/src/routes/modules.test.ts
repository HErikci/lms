import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

describe('module routes', () => {
  let app: FastifyInstance;
  let instructorToken: string;
  let courseId: string;

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
        instructors: { create: [{ userId: instructor.id, position: 1 }] },
      },
    });
    courseId = course.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('updates a module', async () => {
    const module = await prisma.module.create({ data: { courseId, title: 'Modül', order: 1 } });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/modules/${module.id}`,
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: { title: 'Güncellendi' },
    });
    expect(response.statusCode).toBe(200);
    const updated = response.json().module;
    expect(updated.title).toBe('Güncellendi');
    expect(updated.order).toBe(1);
  });

  it('rejects update from a non-owning instructor', async () => {
    const module = await prisma.module.create({ data: { courseId, title: 'Modül', order: 1 } });
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
      method: 'PATCH',
      url: `/api/v1/modules/${module.id}`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { title: 'Hacklendi' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('deletes a module and cascades its lessons', async () => {
    const module = await prisma.module.create({ data: { courseId, title: 'Modül', order: 1 } });
    const lesson = await prisma.lesson.create({
      data: { moduleId: module.id, title: 'Ders', order: 1, status: 'DRAFT' },
    });
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/modules/${module.id}`,
      headers: { authorization: `Bearer ${instructorToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    const foundModule = await prisma.module.findUnique({ where: { id: module.id } });
    const foundLesson = await prisma.lesson.findUnique({ where: { id: lesson.id } });
    expect(foundModule).toBeNull();
    expect(foundLesson).toBeNull();
  });

  it('returns 404 for a nonexistent module', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/modules/does-not-exist`,
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: { title: 'x' },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });
});

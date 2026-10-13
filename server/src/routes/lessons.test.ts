import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

describe('lesson routes', () => {
  const app = buildApp();
  let instructorToken: string;
  let moduleId: string;

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
});

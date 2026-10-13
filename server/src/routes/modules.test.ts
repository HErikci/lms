import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

describe('module routes', () => {
  const app = buildApp();
  let instructorToken: string;
  let courseId: string;

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
        accessMode: 'FREE',
        instructorId: instructor.id,
      },
    });
    courseId = course.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates a module under a course', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${courseId}/modules`,
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: { title: 'Modül 1', order: 1 },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().module.courseId).toBe(courseId);
  });

  it('returns 404 when the course does not exist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/courses/does-not-exist/modules',
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: { title: 'Modül 1', order: 1 },
    });
    expect(response.statusCode).toBe(404);
  });
});

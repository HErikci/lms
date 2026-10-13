import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

describe('course routes', () => {
  const app = buildApp();
  let studentToken: string;
  let instructorToken: string;

  beforeEach(async () => {
    await prisma.enrollment.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.module.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await bcrypt.hash('sifre123', 12);
    await prisma.user.create({
      data: { email: 'student@example.com', passwordHash, name: 'Öğrenci', role: 'STUDENT' },
    });
    await prisma.user.create({
      data: { email: 'instructor@example.com', passwordHash, name: 'Eğitmen', role: 'INSTRUCTOR' },
    });

    const studentLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'student@example.com', password: 'sifre123' },
    });
    studentToken = studentLogin.json().token;

    const instructorLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'instructor@example.com', password: 'sifre123' },
    });
    instructorToken = instructorLogin.json().token;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('allows an instructor to create a course', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/courses',
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: {
        title: 'Test Kursu',
        description: 'Açıklama',
        category: 'Test',
        level: 'Başlangıç',
        tags: ['test', 'örnek'],
        accessMode: 'FREE',
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().course.tags).toEqual(['test', 'örnek']);
  });

  it('rejects a student creating a course', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/courses',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        title: 'Test Kursu',
        description: 'Açıklama',
        category: 'Test',
        level: 'Başlangıç',
        tags: [],
        accessMode: 'FREE',
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('lists courses filtered by category', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/courses',
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: {
        title: 'Yazılım Kursu',
        description: 'Açıklama',
        category: 'Yazılım',
        level: 'Orta',
        tags: [],
        accessMode: 'FREE',
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/courses',
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: {
        title: 'Tasarım Kursu',
        description: 'Açıklama',
        category: 'Tasarım',
        level: 'Orta',
        tags: [],
        accessMode: 'FREE',
      },
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/courses?category=Yazılım' });
    expect(response.statusCode).toBe(200);
    const { courses } = response.json();
    expect(courses).toHaveLength(1);
    expect(courses[0].title).toBe('Yazılım Kursu');
  });

  it('returns 404 for a nonexistent course id', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/courses/does-not-exist' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });
});

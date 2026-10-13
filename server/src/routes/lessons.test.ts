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
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/courses/${module.courseId}`,
      headers: { authorization: `Bearer ${instructorToken}` },
    });
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

  it('creates a lesson with all new content fields and round-trips them', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/modules/${moduleId}/lessons`,
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: {
        title: 'Video Ders',
        order: 1,
        status: 'DRAFT',
        description: 'Bir açıklama',
        contentType: 'VIDEO_YOUTUBE',
        contentUrl: 'https://youtube.com/watch?v=abc',
      },
    });
    expect(response.statusCode).toBe(201);
    const lesson = response.json().lesson;
    expect(lesson.description).toBe('Bir açıklama');
    expect(lesson.contentType).toBe('VIDEO_YOUTUBE');
    expect(lesson.contentUrl).toBe('https://youtube.com/watch?v=abc');
  });

  it('defaults contentType to DOCUMENT when omitted', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/modules/${moduleId}/lessons`,
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: { title: 'Ders', order: 1, status: 'DRAFT' },
    });
    expect(response.json().lesson.contentType).toBe('DOCUMENT');
  });

  it('rejects an invalid contentType on create', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/modules/${moduleId}/lessons`,
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: { title: 'Ders', order: 1, status: 'DRAFT', contentType: 'BOGUS' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_CONTENT_TYPE');
  });

  it('updates a subset of lesson fields without clobbering others', async () => {
    const created = await prisma.lesson.create({
      data: {
        moduleId,
        title: 'Orijinal',
        order: 1,
        status: 'DRAFT',
        description: 'Orijinal açıklama',
        contentType: 'TEXT',
        contentUrl: null,
      },
    });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/lessons/${created.id}`,
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: { title: 'Güncellendi' },
    });
    expect(response.statusCode).toBe(200);
    const lesson = response.json().lesson;
    expect(lesson.title).toBe('Güncellendi');
    expect(lesson.description).toBe('Orijinal açıklama');
    expect(lesson.contentType).toBe('TEXT');
  });

  it('rejects an invalid contentType on patch', async () => {
    const created = await prisma.lesson.create({
      data: { moduleId, title: 'Ders', order: 1, status: 'DRAFT' },
    });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/lessons/${created.id}`,
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: { contentType: 'BOGUS' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_CONTENT_TYPE');
  });

  it('rejects patch from a non-owning instructor', async () => {
    const created = await prisma.lesson.create({
      data: { moduleId, title: 'Ders', order: 1, status: 'DRAFT' },
    });
    const passwordHash = await bcrypt.hash('sifre123', 12);
    await prisma.user.create({
      data: { email: 'other2@example.com', passwordHash, name: 'Diğer Eğitmen', role: 'INSTRUCTOR' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'other2@example.com', password: 'sifre123' },
    });
    const otherToken = login.json().token;
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/lessons/${created.id}`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { title: 'Hacklendi' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('deletes a lesson', async () => {
    const created = await prisma.lesson.create({
      data: { moduleId, title: 'Silinecek', order: 1, status: 'DRAFT' },
    });
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/lessons/${created.id}`,
      headers: { authorization: `Bearer ${instructorToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    const found = await prisma.lesson.findUnique({ where: { id: created.id } });
    expect(found).toBeNull();
  });

  it('includes the new lesson fields in GET /api/v1/courses/:id', async () => {
    await prisma.lesson.create({
      data: {
        moduleId,
        title: 'Ders',
        order: 1,
        status: 'PUBLISHED',
        description: 'Açıklama',
        contentType: 'LINK',
        contentUrl: 'https://example.com',
      },
    });
    const module = await prisma.module.findUniqueOrThrow({ where: { id: moduleId } });
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/courses/${module.courseId}`,
      headers: { authorization: `Bearer ${instructorToken}` },
    });
    const lesson = response.json().course.modules[0].lessons[0];
    expect(lesson.description).toBe('Açıklama');
    expect(lesson.contentType).toBe('LINK');
    expect(lesson.contentUrl).toBe('https://example.com');
  });
});

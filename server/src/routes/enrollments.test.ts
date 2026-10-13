import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

describe('enrollment routes', () => {
  let app: FastifyInstance;
  let studentToken: string;
  let courseId: string;

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
    await prisma.user.create({
      data: { email: 'student@example.com', passwordHash, name: 'Öğrenci', role: 'STUDENT' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'student@example.com', password: 'sifre123' },
    });
    studentToken = login.json().token;

    const course = await prisma.course.create({
      data: {
        title: 'Kurs',
        description: 'Açıklama',
        category: 'Test',
        level: 'Başlangıç',
        accessMode: 'FREE',
        status: 'PUBLISHED',
        instructorId: instructor.id,
      },
    });
    courseId = course.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('enrolls a student in a course', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${courseId}/enroll`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { method: 'OPEN' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().enrollment.courseId).toBe(courseId);
  });

  it('rejects enrolling twice in the same course', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${courseId}/enroll`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { method: 'OPEN' },
    });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${courseId}/enroll`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { method: 'OPEN' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('ALREADY_ENROLLED');
  });

  it('allows an instructor to self-enroll in a course they do not own', async () => {
    const passwordHash = await bcrypt.hash('sifre123', 12);
    await prisma.user.create({
      data: {
        email: 'other-instructor@example.com',
        passwordHash,
        name: 'Diğer Eğitmen',
        role: 'INSTRUCTOR',
      },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'other-instructor@example.com', password: 'sifre123' },
    });
    const otherInstructorToken = login.json().token;

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${courseId}/enroll`,
      headers: { authorization: `Bearer ${otherInstructorToken}` },
      payload: { method: 'OPEN' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().enrollment.courseId).toBe(courseId);
  });

  it('allows an admin to self-enroll in a course', async () => {
    const passwordHash = await bcrypt.hash('sifre123', 12);
    await prisma.user.create({
      data: { email: 'admin@example.com', passwordHash, name: 'Admin', role: 'ADMIN' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@example.com', password: 'sifre123' },
    });
    const adminToken = login.json().token;

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${courseId}/enroll`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { method: 'OPEN' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().enrollment.courseId).toBe(courseId);
  });

  it('404s when enrolling in a draft (unpublished) course', async () => {
    const instructor = await prisma.user.findUniqueOrThrow({
      where: { email: 'instructor@example.com' },
    });
    const draftCourse = await prisma.course.create({
      data: {
        title: 'Taslak Kurs',
        description: 'Açıklama',
        category: 'Test',
        level: 'Başlangıç',
        accessMode: 'FREE',
        status: 'DRAFT',
        instructorId: instructor.id,
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${draftCourse.id}/enroll`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { method: 'OPEN' },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('lists the current user enrolled courses', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${courseId}/enroll`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { method: 'OPEN' },
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/courses',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().courses).toHaveLength(1);
    expect(response.json().courses[0].id).toBe(courseId);
  });
});

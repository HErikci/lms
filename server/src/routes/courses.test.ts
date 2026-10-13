import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

describe('course routes', () => {
  let app: FastifyInstance;
  let studentToken: string;
  let instructorToken: string;

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
    await prisma.course.updateMany({ data: { status: 'PUBLISHED' } });
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

  it('does not list a draft course in the public list', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/courses',
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: {
        title: 'Taslak Kurs',
        description: 'Açıklama',
        category: 'Test',
        level: 'Orta',
        tags: [],
        accessMode: 'FREE',
      },
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/courses' });
    expect(response.statusCode).toBe(200);
    expect(response.json().courses).toHaveLength(0);
  });

  it('404s a draft course detail for an anonymous caller', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/courses',
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: {
        title: 'Taslak Kurs',
        description: 'Açıklama',
        category: 'Test',
        level: 'Orta',
        tags: [],
        accessMode: 'FREE',
      },
    });
    const courseId = createResponse.json().course.id;
    const response = await app.inject({ method: 'GET', url: `/api/v1/courses/${courseId}` });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('404s a draft course detail for another instructor', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/courses',
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: {
        title: 'Taslak Kurs',
        description: 'Açıklama',
        category: 'Test',
        level: 'Orta',
        tags: [],
        accessMode: 'FREE',
      },
    });
    const courseId = createResponse.json().course.id;
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/courses/${courseId}`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(response.statusCode).toBe(404);
  });

  it('allows the owning instructor to view their own draft course', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/courses',
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: {
        title: 'Taslak Kurs',
        description: 'Açıklama',
        category: 'Test',
        level: 'Orta',
        tags: [],
        accessMode: 'FREE',
      },
    });
    const courseId = createResponse.json().course.id;
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/courses/${courseId}`,
      headers: { authorization: `Bearer ${instructorToken}` },
    });
    expect(response.statusCode).toBe(200);
  });

  describe('GET /api/v1/courses/:id enrollment gating', () => {
    async function createPublishedCourseWithModule() {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/courses',
        headers: { authorization: `Bearer ${instructorToken}` },
        payload: {
          title: 'Yayınlanmış Kurs',
          description: 'Açıklama',
          category: 'Test',
          level: 'Orta',
          tags: [],
          accessMode: 'FREE',
        },
      });
      const courseId = createResponse.json().course.id as string;
      const moduleResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/courses/${courseId}/modules`,
        headers: { authorization: `Bearer ${instructorToken}` },
        payload: { title: 'Modül 1', order: 1 },
      });
      const moduleId = moduleResponse.json().module.id as string;
      await app.inject({
        method: 'POST',
        url: `/api/v1/modules/${moduleId}/lessons`,
        headers: { authorization: `Bearer ${instructorToken}` },
        payload: { title: 'Ders 1', order: 1, status: 'PUBLISHED' },
      });
      await prisma.course.update({ where: { id: courseId }, data: { status: 'PUBLISHED' } });
      return courseId;
    }

    it('hides modules and reports isEnrolled: false for an anonymous caller', async () => {
      const courseId = await createPublishedCourseWithModule();
      const response = await app.inject({ method: 'GET', url: `/api/v1/courses/${courseId}` });
      expect(response.statusCode).toBe(200);
      const { course } = response.json();
      expect(course.isEnrolled).toBe(false);
      expect(course.modules).toEqual([]);
    });

    it('hides modules and reports isEnrolled: false for a non-enrolled student', async () => {
      const courseId = await createPublishedCourseWithModule();
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/courses/${courseId}`,
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(response.statusCode).toBe(200);
      const { course } = response.json();
      expect(course.isEnrolled).toBe(false);
      expect(course.modules).toEqual([]);
    });

    it('shows full modules to the owning instructor regardless of enrollment', async () => {
      const courseId = await createPublishedCourseWithModule();
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/courses/${courseId}`,
        headers: { authorization: `Bearer ${instructorToken}` },
      });
      expect(response.statusCode).toBe(200);
      const { course } = response.json();
      expect(course.modules).toHaveLength(1);
      expect(course.modules[0].lessons).toHaveLength(1);
    });

    it('shows full modules to an admin regardless of enrollment', async () => {
      const courseId = await createPublishedCourseWithModule();
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
        method: 'GET',
        url: `/api/v1/courses/${courseId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
      const { course } = response.json();
      expect(course.modules).toHaveLength(1);
    });

    it('shows full modules and isEnrolled: true once the student enrolls', async () => {
      const courseId = await createPublishedCourseWithModule();
      const enrollResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/courses/${courseId}/enroll`,
        headers: { authorization: `Bearer ${studentToken}` },
        payload: { method: 'OPEN' },
      });
      expect(enrollResponse.statusCode).toBe(201);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/courses/${courseId}`,
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(response.statusCode).toBe(200);
      const { course } = response.json();
      expect(course.isEnrolled).toBe(true);
      expect(course.modules).toHaveLength(1);
      expect(course.modules[0].lessons).toHaveLength(1);
    });
  });

  describe('PATCH /api/v1/courses/:id', () => {
    async function createDraft(token: string) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/courses',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          title: 'Taslak Kurs',
          description: 'Açıklama',
          category: 'Test',
          level: 'Orta',
          tags: [],
          accessMode: 'FREE',
        },
      });
      return response.json().course.id as string;
    }

    it('allows the owning instructor to update their course', async () => {
      const courseId = await createDraft(instructorToken);
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/courses/${courseId}`,
        headers: { authorization: `Bearer ${instructorToken}` },
        payload: { title: 'Güncellenmiş Kurs', status: 'PUBLISHED' },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().course.title).toBe('Güncellenmiş Kurs');
      expect(response.json().course.status).toBe('PUBLISHED');
    });

    it('403s when a non-owning instructor tries to update the course', async () => {
      const courseId = await createDraft(instructorToken);
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
      const otherToken = login.json().token;
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/courses/${courseId}`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { title: 'Hacklendi' },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('FORBIDDEN');
    });

    it('allows an admin to update any course', async () => {
      const courseId = await createDraft(instructorToken);
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
        method: 'PATCH',
        url: `/api/v1/courses/${courseId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { title: 'Admin Güncellemesi' },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().course.title).toBe('Admin Güncellemesi');
    });

    it('404s when updating a nonexistent course', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/courses/does-not-exist',
        headers: { authorization: `Bearer ${instructorToken}` },
        payload: { title: 'x' },
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/v1/courses/:id', () => {
    it('deletes a course and cascades to modules, lessons, and enrollments', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/courses',
        headers: { authorization: `Bearer ${instructorToken}` },
        payload: {
          title: 'Kurs',
          description: 'Açıklama',
          category: 'Test',
          level: 'Orta',
          tags: [],
          accessMode: 'FREE',
        },
      });
      const courseId = createResponse.json().course.id;

      const moduleResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/courses/${courseId}/modules`,
        headers: { authorization: `Bearer ${instructorToken}` },
        payload: { title: 'Modül 1', order: 1 },
      });
      const moduleId = moduleResponse.json().module.id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/modules/${moduleId}/lessons`,
        headers: { authorization: `Bearer ${instructorToken}` },
        payload: { title: 'Ders 1', order: 1, status: 'PUBLISHED' },
      });

      await prisma.course.update({ where: { id: courseId }, data: { status: 'PUBLISHED' } });
      await app.inject({
        method: 'POST',
        url: `/api/v1/courses/${courseId}/enroll`,
        headers: { authorization: `Bearer ${studentToken}` },
        payload: { method: 'OPEN' },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/courses/${courseId}`,
        headers: { authorization: `Bearer ${instructorToken}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true });

      expect(await prisma.course.findUnique({ where: { id: courseId } })).toBeNull();
      expect(await prisma.module.findMany({ where: { courseId } })).toHaveLength(0);
      expect(await prisma.lesson.findMany({ where: { moduleId } })).toHaveLength(0);
      expect(await prisma.enrollment.findMany({ where: { courseId } })).toHaveLength(0);
    });

    it('403s when a non-owning instructor tries to delete the course', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/courses',
        headers: { authorization: `Bearer ${instructorToken}` },
        payload: {
          title: 'Kurs',
          description: 'Açıklama',
          category: 'Test',
          level: 'Orta',
          tags: [],
          accessMode: 'FREE',
        },
      });
      const courseId = createResponse.json().course.id;
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/courses/${courseId}`,
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('404s when deleting a nonexistent course', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/courses/does-not-exist',
        headers: { authorization: `Bearer ${instructorToken}` },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET and DELETE /api/v1/courses/:courseId/students', () => {
    it('returns enrolled students for the owning instructor', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/courses',
        headers: { authorization: `Bearer ${instructorToken}` },
        payload: {
          title: 'Kurs',
          description: 'Açıklama',
          category: 'Test',
          level: 'Orta',
          tags: [],
          accessMode: 'FREE',
        },
      });
      const courseId = createResponse.json().course.id;
      await prisma.course.update({ where: { id: courseId }, data: { status: 'PUBLISHED' } });
      await app.inject({
        method: 'POST',
        url: `/api/v1/courses/${courseId}/enroll`,
        headers: { authorization: `Bearer ${studentToken}` },
        payload: { method: 'OPEN' },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/courses/${courseId}/students`,
        headers: { authorization: `Bearer ${instructorToken}` },
      });
      expect(response.statusCode).toBe(200);
      const { students } = response.json();
      expect(students).toHaveLength(1);
      expect(students[0].email).toBe('student@example.com');
    });

    it('403s a non-owning instructor requesting the students list', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/courses',
        headers: { authorization: `Bearer ${instructorToken}` },
        payload: {
          title: 'Kurs',
          description: 'Açıklama',
          category: 'Test',
          level: 'Orta',
          tags: [],
          accessMode: 'FREE',
        },
      });
      const courseId = createResponse.json().course.id;
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/courses/${courseId}/students`,
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('unenrolls a student via DELETE', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/courses',
        headers: { authorization: `Bearer ${instructorToken}` },
        payload: {
          title: 'Kurs',
          description: 'Açıklama',
          category: 'Test',
          level: 'Orta',
          tags: [],
          accessMode: 'FREE',
        },
      });
      const courseId = createResponse.json().course.id;
      await prisma.course.update({ where: { id: courseId }, data: { status: 'PUBLISHED' } });
      await app.inject({
        method: 'POST',
        url: `/api/v1/courses/${courseId}/enroll`,
        headers: { authorization: `Bearer ${studentToken}` },
        payload: { method: 'OPEN' },
      });
      const student = await prisma.user.findUnique({ where: { email: 'student@example.com' } });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/courses/${courseId}/students/${student!.id}`,
        headers: { authorization: `Bearer ${instructorToken}` },
      });
      expect(response.statusCode).toBe(200);
      expect(
        await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: student!.id, courseId } },
        }),
      ).toBeNull();
    });

    it('404s when unenrolling a student who is not enrolled', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/courses',
        headers: { authorization: `Bearer ${instructorToken}` },
        payload: {
          title: 'Kurs',
          description: 'Açıklama',
          category: 'Test',
          level: 'Orta',
          tags: [],
          accessMode: 'FREE',
        },
      });
      const courseId = createResponse.json().course.id;
      const student = await prisma.user.findUnique({ where: { email: 'student@example.com' } });
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/courses/${courseId}/students/${student!.id}`,
        headers: { authorization: `Bearer ${instructorToken}` },
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('ENROLLMENT_NOT_FOUND');
    });
  });
});

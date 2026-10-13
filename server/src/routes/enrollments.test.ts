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
    await prisma.lessonProgress.deleteMany();
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
        instructors: { create: [{ userId: instructor.id, position: 1 }] },
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
        instructors: { create: [{ userId: instructor.id, position: 1 }] },
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
    expect(response.json().courses[0].progress).toEqual({
      percent: 0,
      completedCount: 0,
      totalLessons: 0,
    });
    expect(response.json().courses[0].instructors).toEqual([
      { id: expect.any(String), name: 'Eğitmen', avatarUrl: null, position: 1 },
    ]);
  });

  describe('GET /users/me/courses dashboard fields', () => {
    async function mkCourse(
      title: string,
      modules: { order: number; lessons: { title: string; order: number; status?: string }[] }[],
    ) {
      const course = await prisma.course.create({
        data: {
          title,
          description: 'A',
          category: 'Test',
          level: 'Başlangıç',
          accessMode: 'FREE',
          status: 'PUBLISHED',
        },
      });
      const lessonIds: Record<string, string> = {};
      for (const m of modules) {
        const mod = await prisma.module.create({
          data: { courseId: course.id, title: `M${m.order}`, order: m.order },
        });
        for (const l of m.lessons) {
          const lesson = await prisma.lesson.create({
            data: {
              moduleId: mod.id,
              title: l.title,
              order: l.order,
              status: l.status ?? 'PUBLISHED',
              contentType: 'LINK',
              contentUrl: `https://x.test/${l.title}`,
            },
          });
          lessonIds[l.title] = lesson.id;
        }
      }
      const student = await prisma.user.findUniqueOrThrow({ where: { email: 'student@example.com' } });
      await prisma.enrollment.create({
        data: { userId: student.id, courseId: course.id, method: 'OPEN' },
      });
      return { course, lessonIds, student };
    }

    async function complete(userId: string, lessonId: string) {
      await prisma.lessonProgress.create({ data: { userId, lessonId } });
    }

    async function list() {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me/courses',
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(response.statusCode).toBe(200);
      return response.json().courses as any[];
    }

    it('nextLesson respects module and lesson order and skips completed + DRAFT', async () => {
      const { lessonIds, student } = await mkCourse('A', [
        { order: 2, lessons: [{ title: 'b1', order: 1 }] },
        {
          order: 1,
          lessons: [
            { title: 'a2', order: 2 },
            { title: 'a1', order: 1 },
            { title: 'a0draft', order: 0, status: 'DRAFT' },
          ],
        },
      ]);
      let [item] = await list();
      expect(item.nextLesson).toEqual({
        id: lessonIds.a1,
        title: 'a1',
        contentType: 'LINK',
        contentUrl: 'https://x.test/a1',
      });
      await complete(student.id, lessonIds.a1);
      [item] = await list();
      expect(item.nextLesson.id).toBe(lessonIds.a2);
      await complete(student.id, lessonIds.a2);
      [item] = await list();
      expect(item.nextLesson.id).toBe(lessonIds.b1);
      await complete(student.id, lessonIds.b1);
      [item] = await list();
      expect(item.nextLesson).toBeNull();
      expect(item.progress.percent).toBe(100);
    });

    it('nextLesson is null and moduleCount 0 when course has no published lessons', async () => {
      await mkCourse('Boş', [{ order: 1, lessons: [{ title: 'd', order: 1, status: 'DRAFT' }] }]);
      const [item] = await list();
      expect(item.nextLesson).toBeNull();
      expect(item.moduleCount).toBe(0);
    });

    it('moduleCount counts only modules with a published lesson', async () => {
      await mkCourse('M', [
        { order: 1, lessons: [{ title: 'p', order: 1 }] },
        { order: 2, lessons: [{ title: 'd', order: 1, status: 'DRAFT' }] },
        { order: 3, lessons: [] },
        { order: 4, lessons: [{ title: 'p2', order: 1 }] },
      ]);
      const [item] = await list();
      expect(item.moduleCount).toBe(2);
    });

    it('orders in-progress (high first), then 0, then 100, ties by title', async () => {
      const mk = (title: string, n: number) =>
        mkCourse(
          title,
          [{ order: 1, lessons: Array.from({ length: n }, (_, k) => ({ title: `${title}${k}`, order: k })) }],
        );
      const zeroB = await mk('B-sıfır', 2);
      const zeroA = await mk('A-sıfır', 2);
      const full = await mk('Tam', 1);
      const low = await mk('Düşük', 4); // 25
      const high = await mk('Yüksek', 4); // 75
      const student = high.student;
      await complete(student.id, full.lessonIds['Tam0']);
      await complete(student.id, low.lessonIds['Düşük0']);
      for (const k of [0, 1, 2]) await complete(student.id, high.lessonIds[`Yüksek${k}`]);
      void zeroA;
      void zeroB;
      const titles = (await list()).map((c) => c.title);
      expect(titles).toEqual(['Yüksek', 'Düşük', 'A-sıfır', 'B-sıfır', 'Tam']);
    });

    it('does not leak other users completions into nextLesson', async () => {
      const { lessonIds } = await mkCourse('Iso', [
        { order: 1, lessons: [{ title: 'i1', order: 1 }, { title: 'i2', order: 2 }] },
      ]);
      const passwordHash = await bcrypt.hash('sifre123', 12);
      const other = await prisma.user.create({
        data: { email: 'other@example.com', passwordHash, name: 'Diğer', role: 'STUDENT' },
      });
      await complete(other.id, lessonIds.i1);
      const [item] = await list();
      expect(item.nextLesson.id).toBe(lessonIds.i1);
      expect(item.progress.completedCount).toBe(0);
    });
  });
});

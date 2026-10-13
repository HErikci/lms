import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';

type Role = 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';

describe('course instructors', () => {
  let app: FastifyInstance;
  let admin: { id: string; token: string };
  let student: { id: string; token: string };
  let ins1: { id: string; token: string };
  let ins2: { id: string; token: string };
  let ins3: { id: string; token: string };
  let courseId: string;

  async function makeUser(email: string, name: string, role: Role, roles = role as string) {
    const user = await prisma.user.create({
      data: { email, passwordHash: 'x', name, role, roles, avatarUrl: `https://img/${name}` },
    });
    const token = signToken({ userId: user.id, role, roles: roles.split(',') as Role[] });
    return { id: user.id, token };
  }

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  async function addInstructor(userId: string, position?: number, token = admin.token) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/courses/${courseId}/instructors`,
      headers: auth(token),
      payload: position === undefined ? { userId } : { userId, position },
    });
  }

  const ids = (res: { json: () => { instructors: { id: string }[] } }) =>
    res.json().instructors.map((i) => i.id);
  const positions = (res: { json: () => { instructors: { position: number }[] } }) =>
    res.json().instructors.map((i) => i.position);

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await prisma.enrollment.deleteMany();
    await prisma.lessonProgress.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.module.deleteMany();
    await prisma.courseInstructor.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();
    admin = await makeUser('admin@example.com', 'Yönetici', 'ADMIN');
    student = await makeUser('student@example.com', 'Öğrenci', 'STUDENT');
    ins1 = await makeUser('i1@example.com', 'Ali Eğitmen', 'INSTRUCTOR');
    ins2 = await makeUser('i2@example.com', 'Veli Eğitmen', 'INSTRUCTOR');
    // multi-role user whose active role is STUDENT but who holds INSTRUCTOR
    ins3 = await makeUser('i3@example.com', 'Ayşe Hoca', 'STUDENT', 'STUDENT,INSTRUCTOR');
    const course = await prisma.course.create({
      data: {
        title: 'Kurs',
        description: 'Açıklama',
        category: 'Test',
        level: 'Başlangıç',
        accessMode: 'FREE',
        status: 'PUBLISHED',
      },
    });
    courseId = course.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /courses/:courseId/instructors', () => {
    it('appends by default with dense positions and returns 201', async () => {
      const r1 = await addInstructor(ins1.id);
      expect(r1.statusCode).toBe(201);
      const r2 = await addInstructor(ins2.id);
      expect(ids(r2)).toEqual([ins1.id, ins2.id]);
      expect(positions(r2)).toEqual([1, 2]);
      expect(r2.json().instructors[0]).toEqual({
        id: ins1.id,
        name: 'Ali Eğitmen',
        avatarUrl: 'https://img/Ali Eğitmen',
        position: 1,
      });
    });

    it('inserts at a position and shifts others', async () => {
      await addInstructor(ins1.id);
      await addInstructor(ins2.id);
      const res = await addInstructor(ins3.id, 1);
      expect(ids(res)).toEqual([ins3.id, ins1.id, ins2.id]);
      expect(positions(res)).toEqual([1, 2, 3]);
    });

    it('clamps out-of-range positions', async () => {
      await addInstructor(ins1.id);
      const high = await addInstructor(ins2.id, 99);
      expect(ids(high)).toEqual([ins1.id, ins2.id]);
      const low = await addInstructor(ins3.id, -5);
      expect(ids(low)).toEqual([ins3.id, ins1.id, ins2.id]);
      expect(positions(low)).toEqual([1, 2, 3]);
    });

    it('404s for an unknown course', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/courses/nope/instructors',
        headers: auth(admin.token),
        payload: { userId: ins1.id },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('NOT_FOUND');
    });

    it('404s for an unknown user', async () => {
      const res = await addInstructor('nope');
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('USER_NOT_FOUND');
    });

    it('400s when the user lacks the INSTRUCTOR role', async () => {
      const res = await addInstructor(student.id);
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('USER_NOT_INSTRUCTOR');
    });

    it('409s when already assigned', async () => {
      await addInstructor(ins1.id);
      const res = await addInstructor(ins1.id);
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('INSTRUCTOR_ALREADY_ASSIGNED');
    });

    it('accepts a user who holds INSTRUCTOR as a secondary role', async () => {
      const res = await addInstructor(ins3.id);
      expect(res.statusCode).toBe(201);
    });

    it('is ADMIN-only', async () => {
      for (const token of [student.token, ins1.token]) {
        const res = await addInstructor(ins1.id, undefined, token);
        expect(res.statusCode).toBe(403);
        expect(res.json().error.code).toBe('FORBIDDEN');
      }
      const anon = await app.inject({
        method: 'POST',
        url: `/api/v1/courses/${courseId}/instructors`,
        payload: { userId: ins1.id },
      });
      expect(anon.statusCode).toBe(401);
    });
  });

  describe('DELETE /courses/:courseId/instructors/:userId', () => {
    it('removes and renumbers densely', async () => {
      await addInstructor(ins1.id);
      await addInstructor(ins2.id);
      await addInstructor(ins3.id);
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/courses/${courseId}/instructors/${ins1.id}`,
        headers: auth(admin.token),
      });
      expect(res.statusCode).toBe(200);
      expect(ids(res)).toEqual([ins2.id, ins3.id]);
      expect(positions(res)).toEqual([1, 2]);
    });

    it('allows removing the last instructor', async () => {
      await addInstructor(ins1.id);
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/courses/${courseId}/instructors/${ins1.id}`,
        headers: auth(admin.token),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().instructors).toEqual([]);
    });

    it('404s INSTRUCTOR_NOT_ASSIGNED', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/courses/${courseId}/instructors/${ins1.id}`,
        headers: auth(admin.token),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('INSTRUCTOR_NOT_ASSIGNED');
    });

    it('404s for an unknown course', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/courses/nope/instructors/${ins1.id}`,
        headers: auth(admin.token),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('NOT_FOUND');
    });

    it('is ADMIN-only', async () => {
      await addInstructor(ins1.id);
      for (const token of [student.token, ins1.token]) {
        const res = await app.inject({
          method: 'DELETE',
          url: `/api/v1/courses/${courseId}/instructors/${ins1.id}`,
          headers: auth(token),
        });
        expect(res.statusCode).toBe(403);
      }
    });
  });

  describe('PUT /courses/:courseId/instructors/order', () => {
    const put = (token: string, userIds: unknown) =>
      app.inject({
        method: 'PUT',
        url: `/api/v1/courses/${courseId}/instructors/order`,
        headers: auth(token),
        payload: { userIds },
      });

    it('reorders (not shadowed by :userId routes)', async () => {
      await addInstructor(ins1.id);
      await addInstructor(ins2.id);
      await addInstructor(ins3.id);
      const res = await put(admin.token, [ins3.id, ins1.id, ins2.id]);
      expect(res.statusCode).toBe(200);
      expect(ids(res)).toEqual([ins3.id, ins1.id, ins2.id]);
      expect(positions(res)).toEqual([1, 2, 3]);
    });

    it('400s on missing, extra, duplicate or non-array ids', async () => {
      await addInstructor(ins1.id);
      await addInstructor(ins2.id);
      for (const body of [[ins1.id], [ins1.id, ins2.id, ins3.id], [ins1.id, ins1.id], 'x', [ins1.id, 'zzz']]) {
        const res = await put(admin.token, body);
        expect(res.statusCode).toBe(400);
        expect(res.json().error.code).toBe('INVALID_INSTRUCTOR_ORDER');
      }
      const unchanged = await app.inject({ method: 'GET', url: `/api/v1/courses/${courseId}/instructors` });
      expect(ids(unchanged)).toEqual([ins1.id, ins2.id]);
    });

    it('404s for an unknown course', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/courses/nope/instructors/order',
        headers: auth(admin.token),
        payload: { userIds: [] },
      });
      expect(res.statusCode).toBe(404);
    });

    it('is ADMIN-only', async () => {
      await addInstructor(ins1.id);
      for (const token of [student.token, ins1.token]) {
        const res = await put(token, [ins1.id]);
        expect(res.statusCode).toBe(403);
      }
    });
  });

  describe('GET /courses/:courseId/instructors', () => {
    it('is public for a published course, sorted by position, without email', async () => {
      await addInstructor(ins1.id);
      await addInstructor(ins2.id, 1);
      const res = await app.inject({ method: 'GET', url: `/api/v1/courses/${courseId}/instructors` });
      expect(res.statusCode).toBe(200);
      expect(ids(res)).toEqual([ins2.id, ins1.id]);
      expect(JSON.stringify(res.json())).not.toContain('@example.com');
    });

    it('404s a draft course unless the caller can manage it', async () => {
      await prisma.course.update({ where: { id: courseId }, data: { status: 'DRAFT' } });
      await addInstructor(ins1.id);
      const url = `/api/v1/courses/${courseId}/instructors`;
      expect((await app.inject({ method: 'GET', url })).statusCode).toBe(404);
      expect((await app.inject({ method: 'GET', url, headers: auth(student.token) })).statusCode).toBe(404);
      expect((await app.inject({ method: 'GET', url, headers: auth(ins2.token) })).statusCode).toBe(404);
      expect((await app.inject({ method: 'GET', url, headers: auth(ins1.token) })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url, headers: auth(admin.token) })).statusCode).toBe(200);
    });

    it('404s an unknown course', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/courses/nope/instructors' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('authorization via assignment', () => {
    it('lets an assigned instructor edit modules while an unassigned one gets 403', async () => {
      await addInstructor(ins1.id);
      const ok = await app.inject({
        method: 'POST',
        url: `/api/v1/courses/${courseId}/modules`,
        headers: auth(ins1.token),
        payload: { title: 'Modül', order: 1 },
      });
      expect(ok.statusCode).toBe(201);
      const denied = await app.inject({
        method: 'POST',
        url: `/api/v1/courses/${courseId}/modules`,
        headers: auth(ins2.token),
        payload: { title: 'Modül', order: 2 },
      });
      expect(denied.statusCode).toBe(403);
    });

    it('revokes access after removal and grants it after assignment', async () => {
      const url = `/api/v1/courses/${courseId}`;
      const patch = () =>
        app.inject({ method: 'PATCH', url, headers: auth(ins2.token), payload: { title: 'Yeni' } });
      expect((await patch()).statusCode).toBe(403);
      await addInstructor(ins2.id);
      expect((await patch()).statusCode).toBe(200);
      await app.inject({
        method: 'DELETE',
        url: `${url}/instructors/${ins2.id}`,
        headers: auth(admin.token),
      });
      expect((await patch()).statusCode).toBe(403);
    });

    it('works for a course with 0 instructors (admin manages, public reads)', async () => {
      const detail = await app.inject({ method: 'GET', url: `/api/v1/courses/${courseId}` });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().course.instructors).toEqual([]);
      const patch = await app.inject({
        method: 'PATCH',
        url: `/api/v1/courses/${courseId}`,
        headers: auth(admin.token),
        payload: { title: 'Yeni' },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json().course.instructors).toEqual([]);
    });

    it('PATCH /courses does not change instructors', async () => {
      await addInstructor(ins1.id);
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/courses/${courseId}`,
        headers: auth(admin.token),
        payload: { title: 'Yeni', instructors: [], instructorIds: [ins2.id] },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().course.instructors.map((i: { id: string }) => i.id)).toEqual([ins1.id]);
    });
  });

  describe('POST /courses', () => {
    const create = (token: string, extra: Record<string, unknown> = {}) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/courses',
        headers: auth(token),
        payload: {
          title: 'Yeni Kurs',
          description: 'Açıklama',
          category: 'Test',
          level: 'Başlangıç',
          tags: [],
          accessMode: 'FREE',
          ...extra,
        },
      });

    it('auto-assigns an INSTRUCTOR creator at position 1 and ignores instructorIds', async () => {
      const res = await create(ins1.token, { instructorIds: [ins2.id] });
      expect(res.statusCode).toBe(201);
      const list = res.json().course.instructors;
      expect(list).toEqual([
        { id: ins1.id, name: 'Ali Eğitmen', avatarUrl: 'https://img/Ali Eğitmen', position: 1 },
      ]);
      expect(res.json().course).not.toHaveProperty('instructorId');
    });

    it('creates an admin course with no instructors by default', async () => {
      const res = await create(admin.token);
      expect(res.statusCode).toBe(201);
      expect(res.json().course.instructors).toEqual([]);
    });

    it('uses admin-provided instructorIds in order', async () => {
      const res = await create(admin.token, { instructorIds: [ins2.id, ins3.id, ins2.id] });
      expect(res.statusCode).toBe(201);
      expect(res.json().course.instructors.map((i: { id: string; position: number }) => [i.id, i.position])).toEqual([
        [ins2.id, 1],
        [ins3.id, 2],
      ]);
    });

    it('400s on unknown or non-instructor instructorIds and creates nothing', async () => {
      const before = await prisma.course.count();
      const unknown = await create(admin.token, { instructorIds: ['nope'] });
      expect(unknown.statusCode).toBe(400);
      expect(unknown.json().error.code).toBe('USER_NOT_FOUND');
      const notInstructor = await create(admin.token, { instructorIds: [student.id] });
      expect(notInstructor.statusCode).toBe(400);
      expect(notInstructor.json().error.code).toBe('USER_NOT_INSTRUCTOR');
      expect(await prisma.course.count()).toBe(before);
    });
  });

  describe('public payload', () => {
    it('list and detail include sorted instructors without email', async () => {
      await addInstructor(ins1.id);
      await addInstructor(ins2.id);
      await addInstructor(ins3.id, 1);
      const list = await app.inject({ method: 'GET', url: '/api/v1/courses' });
      const listed = list.json().courses[0].instructors;
      expect(listed.map((i: { id: string }) => i.id)).toEqual([ins3.id, ins1.id, ins2.id]);
      const detail = await app.inject({ method: 'GET', url: `/api/v1/courses/${courseId}` });
      expect(detail.json().course.instructors).toEqual(listed);
      expect(JSON.stringify(list.json())).not.toContain('@example.com');
      expect(JSON.stringify(detail.json())).not.toContain('@example.com');
      expect(Object.keys(listed[0]).sort()).toEqual(['avatarUrl', 'id', 'name', 'position']);
    });
  });

  describe('cascade', () => {
    it('removes assignments when the course is deleted, keeps the users', async () => {
      await addInstructor(ins1.id);
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/courses/${courseId}`,
        headers: auth(admin.token),
      });
      expect(res.statusCode).toBe(200);
      expect(await prisma.courseInstructor.count()).toBe(0);
      expect(await prisma.user.findUnique({ where: { id: ins1.id } })).not.toBeNull();
    });

    it('removes assignments when the user is deleted', async () => {
      await addInstructor(ins1.id);
      await prisma.user.delete({ where: { id: ins1.id } });
      expect(await prisma.courseInstructor.count()).toBe(0);
    });
  });

  describe('GET /instructors', () => {
    const get = (token: string, q?: string) =>
      app.inject({
        method: 'GET',
        url: q === undefined ? '/api/v1/instructors' : `/api/v1/instructors?q=${encodeURIComponent(q)}`,
        headers: auth(token),
      });

    it('lists users holding INSTRUCTOR (incl. secondary role) with email', async () => {
      const res = await get(admin.token);
      expect(res.statusCode).toBe(200);
      const list = res.json().instructors as { id: string; email: string }[];
      expect(list.map((i) => i.id).sort()).toEqual([ins1.id, ins2.id, ins3.id].sort());
      expect(list[0]).toHaveProperty('email');
      expect(Object.keys(list[0]).sort()).toEqual(['avatarUrl', 'email', 'id', 'name']);
    });

    it('does not match roles that merely contain the substring', async () => {
      await prisma.user.create({
        data: { email: 'x@example.com', passwordHash: 'x', name: 'Sahte', role: 'STUDENT', roles: 'STUDENT,INSTRUCTORX' },
      });
      const res = await get(admin.token);
      expect(res.json().instructors.map((i: { name: string }) => i.name)).not.toContain('Sahte');
    });

    it('filters by name or email via q', async () => {
      const byName = await get(admin.token, 'Veli');
      expect(byName.json().instructors.map((i: { id: string }) => i.id)).toEqual([ins2.id]);
      const byEmail = await get(admin.token, 'i3@');
      expect(byEmail.json().instructors.map((i: { id: string }) => i.id)).toEqual([ins3.id]);
      const none = await get(admin.token, 'zzzz');
      expect(none.json().instructors).toEqual([]);
    });

    it('is ADMIN-only', async () => {
      expect((await get(student.token)).statusCode).toBe(403);
      expect((await get(ins1.token)).statusCode).toBe(403);
      expect((await app.inject({ method: 'GET', url: '/api/v1/instructors' })).statusCode).toBe(401);
    });
  });
});

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';

describe('admin user routes', () => {
  let app: FastifyInstance;
  let adminId: string;
  let adminToken: string;
  let studentId: string;
  let studentToken: string;
  let instructorId: string;

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  function list(token: string, query = '') {
    return app.inject({ method: 'GET', url: `/api/v1/admin/users${query}`, headers: auth(token) });
  }
  function post(token: string, payload: unknown) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/admin/users',
      headers: auth(token),
      payload: payload as Record<string, unknown>,
    });
  }
  function patch(token: string, id: string, payload: unknown) {
    return app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${id}`,
      headers: auth(token),
      payload: payload as Record<string, unknown>,
    });
  }
  function login(email: string, password: string) {
    return app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password } });
  }

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await prisma.courseInstructor.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.module.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await bcrypt.hash('sifre123', 4);
    const admin = await prisma.user.create({
      data: { email: 'admin@example.com', passwordHash, name: 'Yönetici', role: 'ADMIN', roles: 'STUDENT,ADMIN' },
    });
    const student = await prisma.user.create({
      data: { email: 'ogrenci@example.com', passwordHash, name: 'Öğrenci', role: 'STUDENT', roles: 'STUDENT' },
    });
    const instructor = await prisma.user.create({
      data: { email: 'egitmen@example.com', passwordHash, name: 'Eğitmen', role: 'INSTRUCTOR', roles: 'INSTRUCTOR' },
    });
    adminId = admin.id;
    studentId = student.id;
    instructorId = instructor.id;
    adminToken = signToken({ userId: admin.id, role: 'ADMIN', roles: ['STUDENT', 'ADMIN'] });
    studentToken = signToken({ userId: student.id, role: 'STUDENT', roles: ['STUDENT'] });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('GET /admin/users', () => {
    it('is admin-only', async () => {
      expect((await list(studentToken)).statusCode).toBe(403);
      expect((await app.inject({ method: 'GET', url: '/api/v1/admin/users' })).statusCode).toBe(401);
    });

    it('lists users with counts, summary and no password hash', async () => {
      const res = await list(adminToken);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.total).toBe(3);
      expect(body.summary).toEqual({ total: 3, disabled: 0, students: 2, instructors: 1, admins: 1 });
      const admin = body.users.find((u: { id: string }) => u.id === adminId);
      expect(admin).toMatchObject({ roles: ['STUDENT', 'ADMIN'], status: 'ACTIVE', enrollmentCount: 0, teachingCount: 0 });
      expect(admin.passwordHash).toBeUndefined();
    });

    it('filters by search, role and status and paginates', async () => {
      const names = (res: { json: () => { users: { name: string }[] } }) => res.json().users.map((u) => u.name);
      expect(names(await list(adminToken, '?q=egitmen'))).toEqual(['Eğitmen']);
      expect(names(await list(adminToken, '?role=ADMIN'))).toEqual(['Yönetici']);
      await prisma.user.update({ where: { id: studentId }, data: { disabledAt: new Date() } });
      expect(names(await list(adminToken, '?status=DISABLED'))).toEqual(['Öğrenci']);

      const page = (await list(adminToken, '?pageSize=2&page=2')).json();
      expect(page).toMatchObject({ total: 3, page: 2, pageSize: 2 });
      expect(page.users).toHaveLength(1);
    });

    it('validates query parameters', async () => {
      expect((await list(adminToken, '?role=ROOT')).statusCode).toBe(400);
      expect((await list(adminToken, '?status=X')).statusCode).toBe(400);
      expect((await list(adminToken, '?pageSize=500')).statusCode).toBe(400);
      expect((await list(adminToken, '?page=0')).statusCode).toBe(400);
    });
  });

  describe('POST /admin/users', () => {
    it('creates a user who can log in with the least-privileged active role', async () => {
      const res = await post(adminToken, {
        name: '  Yeni Eğitmen ',
        email: 'yeni@example.com',
        password: 'gizli1234',
        roles: ['ADMIN', 'INSTRUCTOR'],
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().user).toMatchObject({ name: 'Yeni Eğitmen', role: 'INSTRUCTOR', roles: ['INSTRUCTOR', 'ADMIN'] });
      expect((await login('yeni@example.com', 'gizli1234')).statusCode).toBe(200);
    });

    it('validates input and rejects duplicate e-mails', async () => {
      const base = { name: 'X', email: 'x@example.com', password: 'gizli1234', roles: ['STUDENT'] };
      expect((await post(adminToken, { ...base, email: 'yanlis' })).json().error.code).toBe('INVALID_EMAIL');
      expect((await post(adminToken, { ...base, password: 'kisa' })).json().error.code).toBe('WEAK_PASSWORD');
      expect((await post(adminToken, { ...base, roles: [] })).statusCode).toBe(400);
      expect((await post(adminToken, { ...base, roles: ['ROOT'] })).statusCode).toBe(400);
      expect((await post(adminToken, { ...base, name: ' ' })).statusCode).toBe(400);
      expect((await post(adminToken, { ...base, email: 'ogrenci@example.com' })).statusCode).toBe(409);
      expect((await post(studentToken, base)).statusCode).toBe(403);
    });
  });

  describe('PATCH /admin/users/:id', () => {
    it('updates name, e-mail and password', async () => {
      const res = await patch(adminToken, studentId, { name: 'Ali', email: 'ali@example.com', password: 'yenisifre1' });
      expect(res.json().user).toMatchObject({ name: 'Ali', email: 'ali@example.com' });
      expect((await login('ali@example.com', 'yenisifre1')).statusCode).toBe(200);
      expect((await patch(adminToken, studentId, { email: 'egitmen@example.com' })).statusCode).toBe(409);
    });

    it('requires a field and returns 404 for unknown users', async () => {
      expect((await patch(adminToken, studentId, {})).statusCode).toBe(400);
      expect((await patch(adminToken, 'yok', { name: 'x' })).statusCode).toBe(404);
    });

    it('disabling blocks login and revokes existing tokens; enabling restores access', async () => {
      const res = await patch(adminToken, studentId, { disabled: true });
      expect(res.json().user.status).toBe('DISABLED');
      expect((await login('ogrenci@example.com', 'sifre123')).json().error.code).toBe('ACCOUNT_DISABLED');
      // Yanlış şifrede devre dışı olduğu söylenmez.
      expect((await login('ogrenci@example.com', 'yanlis123')).json().error.code).toBe('INVALID_CREDENTIALS');
      const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: auth(studentToken) });
      expect(me.statusCode).toBe(401);

      await patch(adminToken, studentId, { disabled: false });
      expect((await login('ogrenci@example.com', 'sifre123')).statusCode).toBe(200);
    });

    it('revoking the active role resets it and invalidates tokens for that role', async () => {
      await prisma.user.update({ where: { id: studentId }, data: { roles: 'STUDENT,INSTRUCTOR', role: 'INSTRUCTOR' } });
      const instructorSession = signToken({ userId: studentId, role: 'INSTRUCTOR', roles: ['STUDENT', 'INSTRUCTOR'] });

      const res = await patch(adminToken, studentId, { roles: ['STUDENT'] });
      expect(res.json().user).toMatchObject({ role: 'STUDENT', roles: ['STUDENT'] });
      const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: auth(instructorSession) });
      expect(me.statusCode).toBe(401);
    });

    it('prevents admins from locking themselves out', async () => {
      expect((await patch(adminToken, adminId, { disabled: true })).json().error.code).toBe('SELF_LOCKOUT');
      expect((await patch(adminToken, adminId, { roles: ['STUDENT'] })).json().error.code).toBe('SELF_LOCKOUT');
      expect((await patch(adminToken, adminId, { name: 'Yeni Ad' })).statusCode).toBe(200);
    });

    it('will not strip the instructor role while the user teaches courses', async () => {
      const course = await prisma.course.create({
        data: { title: 'Kurs', description: 'A', category: 'T', level: 'B', status: 'PUBLISHED' },
      });
      await prisma.courseInstructor.create({ data: { courseId: course.id, userId: instructorId, position: 1 } });
      const res = await patch(adminToken, instructorId, { roles: ['STUDENT'] });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('INSTRUCTOR_HAS_COURSES');
      expect((await patch(adminToken, instructorId, { roles: ['STUDENT', 'INSTRUCTOR'] })).statusCode).toBe(200);
    });
  });
});

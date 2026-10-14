import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { signToken, type TokenPayload } from '../lib/jwt.js';
import { addDays, dayKey } from '../lib/activity.js';

describe('guardian routes', () => {
  let app: FastifyInstance;
  let admin: string;
  let guardian: string;
  let stranger: string;
  let student: string;
  let adminHeaders: { authorization: string };
  let guardianHeaders: { authorization: string };
  let strangerHeaders: { authorization: string };
  let studentHeaders: { authorization: string };

  async function user(name: string, role: TokenPayload['role'], birthDate: Date | null = null) {
    const created = await prisma.user.create({ data: { name, email: `${name}@example.com`, passwordHash: 'fixture', role, roles: role, birthDate } });
    return { id: created.id, headers: { authorization: `Bearer ${signToken({ userId: created.id, role, roles: [role] })}` } };
  }

  async function link(guardianId = guardian, studentId = student) {
    return prisma.guardianLink.create({ data: { guardianId, studentId } });
  }

  beforeAll(async () => { app = await buildApp(); });
  beforeEach(async () => {
    await prisma.guardianNotification.deleteMany();
    await prisma.guardianLink.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();
    const a = await user('admin', 'ADMIN');
    const g = await user('guardian', 'GUARDIAN');
    const s = await user('student', 'STUDENT', new Date(`${new Date().getUTCFullYear() - 12}-01-01T00:00:00Z`));
    const other = await user('stranger', 'GUARDIAN');
    admin = a.id; adminHeaders = a.headers;
    guardian = g.id; guardianHeaders = g.headers;
    student = s.id; studentHeaders = s.headers;
    stranger = other.id; strangerHeaders = other.headers;
  });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  it('only administrators can establish or remove links', async () => {
    const payload = { studentId: student, guardianId: guardian };
    for (const headers of [guardianHeaders, studentHeaders]) {
      expect((await app.inject({ method: 'POST', url: '/api/v1/admin/guardians', headers, payload })).statusCode).toBe(403);
    }
    expect((await app.inject({ method: 'POST', url: '/api/v1/admin/guardians', payload })).statusCode).toBe(401);
    const created = await app.inject({ method: 'POST', url: '/api/v1/admin/guardians', headers: adminHeaders, payload });
    expect(created.statusCode).toBe(201);
    expect(created.json().link.student.birthDate).toMatch(/^\d{4}-01-01$/);
    const id = created.json().link.id;
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/admin/guardians/${id}`, headers: guardianHeaders })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/v1/admin/guardians', headers: adminHeaders, payload })).statusCode).toBe(409);
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/admin/guardians/${id}`, headers: adminHeaders })).statusCode).toBe(200);
    expect(await prisma.guardianLink.count()).toBe(0);
  });

  it.each(['adult', 'unknown', 'nonstudent', 'disabled'])(
    'rejects linking an ineligible %s account', async (condition) => {
      const data = condition === 'adult' ? { birthDate: new Date('1990-01-01') }
        : condition === 'unknown' ? { birthDate: null }
          : condition === 'nonstudent' ? { role: 'INSTRUCTOR', roles: 'INSTRUCTOR' }
            : { disabledAt: new Date() };
      await prisma.user.update({ where: { id: student }, data });
      const response = await app.inject({ method: 'POST', url: '/api/v1/admin/guardians', headers: adminHeaders, payload: { studentId: student, guardianId: guardian } });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('NOT_A_MINOR_STUDENT');
      expect(await prisma.guardianLink.count()).toBe(0);
    },
  );

  it.each(['nonGuardian', 'disabled'])('rejects linking a %s guardian', async (condition) => {
    await prisma.user.update({ where: { id: guardian }, data: condition === 'disabled' ? { disabledAt: new Date() } : { role: 'STUDENT', roles: 'STUDENT' } });
    const response = await app.inject({ method: 'POST', url: '/api/v1/admin/guardians', headers: adminHeaders, payload: { studentId: student, guardianId: guardian } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('NOT_A_GUARDIAN');
  });

  it('isolates child reports, preferences, notification requests and history by guardian', async () => {
    const ownLink = await link();
    const unrelated = await user('other-child', 'STUDENT', new Date('2018-01-01'));
    const unrelatedLink = await link(stranger, unrelated.id);
    await prisma.guardianNotification.createMany({ data: [
      { linkId: ownLink.id, channel: 'EMAIL', status: 'SENT' },
      { linkId: unrelatedLink.id, channel: 'SMS', status: 'SENT' },
    ] });
    const children = await app.inject({ url: '/api/v1/guardian/children', headers: guardianHeaders });
    expect(children.statusCode).toBe(200);
    expect(children.json().children.map((child: { report: { student: { id: string } } }) => child.report.student.id)).toEqual([student]);
    const history = await app.inject({ url: '/api/v1/guardian/notifications', headers: guardianHeaders });
    expect(history.json().notifications).toHaveLength(1);
    expect(history.json().notifications[0].student.id).toBe(student);
    expect((await app.inject({ method: 'PATCH', url: `/api/v1/guardian/links/${unrelatedLink.id}`, headers: guardianHeaders, payload: { emailEnabled: true } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: `/api/v1/guardian/children/${unrelated.id}/notify`, headers: guardianHeaders, payload: { channel: 'EMAIL' } })).statusCode).toBe(404);
    expect((await app.inject({ url: '/api/v1/guardian/children', headers: studentHeaders })).statusCode).toBe(403);
    const prefs = await app.inject({ method: 'PATCH', url: `/api/v1/guardian/links/${ownLink.id}`, headers: guardianHeaders, payload: { emailEnabled: true, phone: '+905551234567', smsEnabled: true } });
    expect(prefs.statusCode).toBe(200);
    expect(prefs.json().link).toMatchObject({ emailEnabled: true, smsEnabled: true, phone: '+905551234567' });
    const disabledChannel = await app.inject({ method: 'POST', url: `/api/v1/guardian/children/${unrelated.id}/notify`, headers: strangerHeaders, payload: { channel: 'EMAIL' } });
    expect(disabledChannel.statusCode).toBe(400);
    expect(disabledChannel.json().error.code).toBe('NOTIFICATION_DISABLED');
  });

  it.each(['adult', 'unknown', 'nonstudent', 'disabled', 'deletedLink'])(
    'revokes existing report, preferences, notification and history access after %s change', async (condition) => {
      const existing = await link();
      await prisma.guardianNotification.create({ data: { linkId: existing.id, channel: 'EMAIL', status: 'SENT' } });
      if (condition === 'deletedLink') await prisma.guardianLink.delete({ where: { id: existing.id } });
      else await prisma.user.update({ where: { id: student }, data: condition === 'adult' ? { birthDate: new Date('1990-01-01') } : condition === 'unknown' ? { birthDate: null } : condition === 'nonstudent' ? { role: 'INSTRUCTOR', roles: 'INSTRUCTOR' } : { disabledAt: new Date() } });
      expect((await app.inject({ url: '/api/v1/guardian/children', headers: guardianHeaders })).json().children).toEqual([]);
      expect((await app.inject({ url: '/api/v1/guardian/notifications', headers: guardianHeaders })).json().notifications).toEqual([]);
      expect((await app.inject({ method: 'PATCH', url: `/api/v1/guardian/links/${existing.id}`, headers: guardianHeaders, payload: { emailEnabled: true } })).statusCode).toBe(404);
      expect((await app.inject({ method: 'POST', url: `/api/v1/guardian/children/${student}/notify`, headers: guardianHeaders, payload: { channel: 'EMAIL' } })).statusCode).toBe(404);
    },
  );

  it.each(['disabled', 'roleRemoved'])('rejects an existing guardian session after %s', async (condition) => {
    await link();
    await prisma.user.update({ where: { id: guardian }, data: condition === 'disabled' ? { disabledAt: new Date() } : { role: 'STUDENT', roles: 'STUDENT' } });
    for (const url of ['/api/v1/guardian/children', '/api/v1/guardian/notifications']) {
      expect((await app.inject({ url, headers: guardianHeaders })).statusCode).toBe(401);
    }
  });

  it('requires a valid phone and boolean opt-in before enabling SMS', async () => {
    const existing = await link();
    for (const payload of [{ smsEnabled: true }, { phone: '05551234567' }, { phone: '+905551234567', smsEnabled: 'yes' }, {}]) {
      expect((await app.inject({ method: 'PATCH', url: `/api/v1/guardian/links/${existing.id}`, headers: guardianHeaders, payload })).statusCode).toBe(400);
    }
    expect((await app.inject({ method: 'POST', url: `/api/v1/admin/guardians`, headers: adminHeaders, payload: { guardianId: stranger, studentId: student, smsEnabled: true } })).statusCode).toBe(400);
  });

  it('reports only enrolled published content and respects both exam result settings', async () => {
    await link();
    const course = await prisma.course.create({ data: { title: 'Published course', description: '', category: 'test', level: 'test', status: 'PUBLISHED' } });
    const excludedCourse = await prisma.course.create({ data: { title: 'Draft course', description: '', category: 'test', level: 'test', status: 'DRAFT' } });
    await prisma.enrollment.createMany({ data: [course, excludedCourse].map((c) => ({ courseId: c.id, userId: student, method: 'ADMIN' })) });
    const module = await prisma.module.create({ data: { courseId: course.id, title: 'Module', order: 1 } });
    const lessons = await Promise.all(['PUBLISHED', 'PUBLISHED', 'DRAFT'].map((status, order) => prisma.lesson.create({ data: { moduleId: module.id, title: `Lesson ${order}`, order, status, contentType: 'QUIZ' } })));
    await prisma.lessonProgress.create({ data: { userId: student, lessonId: lessons[0]!.id } });
    await prisma.quizGrade.createMany({ data: [{ userId: student, lessonId: lessons[0]!.id, score: 85 }, { userId: student, lessonId: lessons[2]!.id, score: 99 }] });
    const today = dayKey(new Date());
    await prisma.studyActivity.createMany({ data: [
      { userId: student, courseId: course.id, day: today, category: 'READING', seconds: 300 },
      { userId: student, courseId: course.id, day: addDays(today, -6), category: 'READING', seconds: 200 },
      { userId: student, courseId: course.id, day: addDays(today, -7), category: 'READING', seconds: 900 },
      { userId: student, courseId: excludedCourse.id, day: today, category: 'READING', seconds: 900 },
    ] });
    for (const [title, current, snapshot, status] of [
      ['Visible', true, true, 'SUBMITTED'], ['Snapshot hidden', true, false, 'SUBMITTED'],
      ['Current hidden', false, true, 'SUBMITTED'], ['Pending', true, true, 'IN_PROGRESS'],
    ] as const) {
      const exam = await prisma.exam.create({ data: { title, courseId: course.id, status: 'PUBLISHED', showResults: current } });
      await prisma.examAttempt.create({ data: { examId: exam.id, userId: student, number: 1, status, snapshot: JSON.stringify({ showResults: snapshot }), result: JSON.stringify({ score: 73, answers: { secret: true } }), submittedAt: status === 'SUBMITTED' ? new Date() : null } });
    }
    const response = await app.inject({ url: '/api/v1/guardian/children', headers: guardianHeaders });
    expect(response.statusCode).toBe(200);
    const report = response.json().children[0].report;
    expect(report.courses).toEqual([{ id: course.id, title: 'Published course', progress: { percent: 50, completedCount: 1, totalLessons: 2 } }]);
    expect(report.grades).toHaveLength(1);
    expect(report.grades[0]).toMatchObject({ score: 85, lessonTitle: 'Lesson 0' });
    expect(report.studySeconds).toBe(500);
    expect(Object.fromEntries(report.exams.map((exam: { title: string; score: number | null }) => [exam.title, exam.score]))).toEqual({ Visible: 73, 'Snapshot hidden': null, 'Current hidden': null, Pending: null });
    expect(JSON.stringify(report)).not.toContain('secret');
  });

  it('validates and persists birth dates through registration and administration', async () => {
    const payload = { name: 'Registered child', email: 'registered@example.com', password: 'password123', birthDate: '2012-02-29' };
    const registered = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload });
    expect(registered.statusCode).toBe(200);
    expect(registered.json().user.birthDate).toBe('2012-02-29');
    const created = await app.inject({ method: 'POST', url: '/api/v1/admin/users', headers: adminHeaders, payload: { ...payload, email: 'created@example.com', roles: ['GUARDIAN'] } });
    expect(created.statusCode).toBe(201);
    expect(created.json().user.birthDate).toBe('2012-02-29');
    const patched = await app.inject({ method: 'PATCH', url: `/api/v1/admin/users/${student}`, headers: adminHeaders, payload: { birthDate: '2011-06-15' } });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().user.birthDate).toBe('2011-06-15');
    for (const birthDate of ['2011-02-29', '9999-01-01', 12]) {
      expect((await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { ...payload, email: 'invalid-register@example.com', birthDate } })).statusCode).toBe(400);
      expect((await app.inject({ method: 'POST', url: '/api/v1/admin/users', headers: adminHeaders, payload: { ...payload, email: 'invalid-admin@example.com', birthDate } })).statusCode).toBe(400);
      expect((await app.inject({ method: 'PATCH', url: `/api/v1/admin/users/${student}`, headers: adminHeaders, payload: { birthDate } })).statusCode).toBe(400);
    }
    const cleared = await app.inject({ method: 'PATCH', url: `/api/v1/admin/users/${student}`, headers: adminHeaders, payload: { birthDate: null } });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().user.birthDate).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: student } })).birthDate).toBeNull();
  });
});

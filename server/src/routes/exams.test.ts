import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';

const HOUR = 60 * 60 * 1000;

describe('exam routes', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let instructorToken: string;
  let studentToken: string;
  let student2Token: string;
  let outsiderToken: string;
  let studentId: string;
  let student2Id: string;
  let outsiderId: string;
  let courseA: string; // eğitmen atanmış; student ve student2 kayıtlı
  let courseB: string; // outsider kayıtlı
  let qA1: string; // A bankası
  let qA2: string;
  let qGeneral: string; // genel banka
  let qB: string; // B bankası

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const req = (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, token: string, payload?: unknown) =>
    app.inject({ method, url, headers: auth(token), payload: payload as Record<string, unknown> | undefined });

  async function question(bankId: string, stem: string, points = 1) {
    const q = await prisma.question.create({
      data: { bankId, type: 'TRUE_FALSE', stem, content: JSON.stringify({ correctAnswer: true }), points },
    });
    return q.id;
  }

  async function createExam(token = instructorToken, extra: Record<string, unknown> = {}) {
    return req('POST', '/api/v1/exams', token, { courseId: courseA, title: 'Ara Sınav', ...extra });
  }

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await prisma.exam.deleteMany();
    await prisma.questionBank.deleteMany();
    await prisma.courseInstructor.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();

    const makeUser = (email: string, role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT') =>
      prisma.user.create({ data: { email, passwordHash: 'x', name: email, role, roles: role } });
    const admin = await makeUser('admin@example.com', 'ADMIN');
    const instructor = await makeUser('instructor@example.com', 'INSTRUCTOR');
    const student = await makeUser('b-student@example.com', 'STUDENT');
    const student2 = await makeUser('a-student@example.com', 'STUDENT');
    const outsider = await makeUser('outsider@example.com', 'STUDENT');
    studentId = student.id;
    student2Id = student2.id;
    outsiderId = outsider.id;
    const tokenFor = (userId: string, role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT') => signToken({ userId, role, roles: [role] });
    adminToken = tokenFor(admin.id, 'ADMIN');
    instructorToken = tokenFor(instructor.id, 'INSTRUCTOR');
    studentToken = tokenFor(student.id, 'STUDENT');
    student2Token = tokenFor(student2.id, 'STUDENT');
    outsiderToken = tokenFor(outsider.id, 'STUDENT');

    const makeCourse = (title: string) =>
      prisma.course.create({ data: { title, description: 'A', category: 'T', level: 'B', status: 'PUBLISHED' } });
    courseA = (await makeCourse('Kurs A')).id;
    courseB = (await makeCourse('Kurs B')).id;
    await prisma.courseInstructor.create({ data: { courseId: courseA, userId: instructor.id, position: 1 } });
    for (const userId of [student.id, student2.id]) {
      await prisma.enrollment.create({ data: { userId, courseId: courseA, method: 'OPEN' } });
    }
    await prisma.enrollment.create({ data: { userId: outsider.id, courseId: courseB, method: 'OPEN' } });

    const bankA = await prisma.questionBank.create({ data: { name: 'A', courseId: courseA } });
    const bankGeneral = await prisma.questionBank.create({ data: { name: 'Genel', courseId: null } });
    const bankB = await prisma.questionBank.create({ data: { name: 'B', courseId: courseB } });
    qA1 = await question(bankA.id, 'A1', 2);
    qA2 = await question(bankA.id, 'A2', 3);
    qGeneral = await question(bankGeneral.id, 'Genel 1');
    qB = await question(bankB.id, 'B1');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('create / update / delete', () => {
    it('lets course managers create draft exams only', async () => {
      expect((await createExam(studentToken)).statusCode).toBe(403);
      expect((await req('POST', '/api/v1/exams', instructorToken, { courseId: courseB, title: 'x' })).statusCode).toBe(403);
      expect((await req('POST', '/api/v1/exams', instructorToken, { title: 'x' })).statusCode).toBe(400);

      const res = await createExam(instructorToken, { status: 'PUBLISHED', durationMinutes: 45, passingScore: 60 });
      expect(res.statusCode).toBe(201);
      expect(res.json().exam).toMatchObject({
        title: 'Ara Sınav',
        status: 'DRAFT',
        durationMinutes: 45,
        passingScore: 60,
        audience: 'COURSE',
        course: { id: courseA, title: 'Kurs A' },
        questionCount: 0,
        candidateCount: 2,
      });
      expect(res.json().questions).toEqual([]);
    });

    it('validates settings and keeps the course immutable', async () => {
      const id = (await createExam()).json().exam.id;
      expect((await req('PATCH', `/api/v1/exams/${id}`, instructorToken, { courseId: courseB })).statusCode).toBe(400);
      expect((await req('PATCH', `/api/v1/exams/${id}`, instructorToken, {})).statusCode).toBe(400);
      const window = { startsAt: '2026-11-01T09:00:00Z', endsAt: '2026-11-01T10:00:00Z' };
      expect((await req('PATCH', `/api/v1/exams/${id}`, instructorToken, { ...window, durationMinutes: 90 })).statusCode).toBe(400);
      const ok = await req('PATCH', `/api/v1/exams/${id}`, instructorToken, { ...window, durationMinutes: 60, shuffleOptions: true });
      expect(ok.json().exam).toMatchObject({ durationMinutes: 60, shuffleOptions: true, startsAt: '2026-11-01T09:00:00.000Z' });
      // null ile alan temizlenir.
      const cleared = await req('PATCH', `/api/v1/exams/${id}`, instructorToken, { startsAt: null, endsAt: null });
      expect(cleared.json().exam).toMatchObject({ startsAt: null, endsAt: null, durationMinutes: 60 });
    });

    it('lists only manageable exams and deletes', async () => {
      const id = (await createExam()).json().exam.id;
      await prisma.exam.create({ data: { title: 'B sınavı', courseId: courseB } });
      const titles = async (token: string) =>
        (await req('GET', '/api/v1/exams/manage', token)).json().exams.map((e: { title: string }) => e.title).sort();
      expect(await titles(instructorToken)).toEqual(['Ara Sınav']);
      expect(await titles(adminToken)).toEqual(['Ara Sınav', 'B sınavı']);
      expect((await req('GET', '/api/v1/exams/manage', studentToken)).statusCode).toBe(403);

      expect((await req('DELETE', `/api/v1/exams/${id}`, studentToken)).statusCode).toBe(403);
      expect((await req('DELETE', `/api/v1/exams/${id}`, instructorToken)).json()).toEqual({ deleted: true });
      expect((await req('GET', `/api/v1/exams/${id}`, instructorToken)).statusCode).toBe(404);
    });
  });

  describe('exam questions', () => {
    it('adds questions from the course and general banks only, skipping duplicates', async () => {
      const id = (await createExam()).json().exam.id;
      const added = await req('POST', `/api/v1/exams/${id}/questions`, instructorToken, { questionIds: [qA2, qGeneral] });
      expect(added.statusCode).toBe(200);
      expect(added.json().questions.map((q: { questionId: string; position: number; points: number }) => [q.questionId, q.position, q.points])).toEqual([
        [qA2, 1, 3],
        [qGeneral, 2, 1],
      ]);
      expect(added.json().exam).toMatchObject({ questionCount: 2, totalPoints: 4 });

      const again = await req('POST', `/api/v1/exams/${id}/questions`, instructorToken, { questionIds: [qGeneral, qA1] });
      expect(again.json().questions.map((q: { questionId: string }) => q.questionId)).toEqual([qA2, qGeneral, qA1]);

      // Eğitmen B bankasını göremez (404); yönetici görür ama başka kursun sorusunu ekleyemez (400).
      expect((await req('POST', `/api/v1/exams/${id}/questions`, instructorToken, { questionIds: [qB] })).statusCode).toBe(404);
      expect((await req('POST', `/api/v1/exams/${id}/questions`, adminToken, { questionIds: [qB] })).statusCode).toBe(400);
      expect((await req('POST', `/api/v1/exams/${id}/questions`, instructorToken, { questionIds: [] })).statusCode).toBe(400);
    });

    it('reorders, re-points and removes questions keeping positions contiguous', async () => {
      const id = (await createExam()).json().exam.id;
      await req('POST', `/api/v1/exams/${id}/questions`, instructorToken, { questionIds: [qA1, qA2, qGeneral] });

      expect((await req('PUT', `/api/v1/exams/${id}/questions/order`, instructorToken, { questionIds: [qA1, qA2] })).statusCode).toBe(400);
      const ordered = await req('PUT', `/api/v1/exams/${id}/questions/order`, instructorToken, { questionIds: [qGeneral, qA1, qA2] });
      expect(ordered.json().questions.map((q: { questionId: string }) => q.questionId)).toEqual([qGeneral, qA1, qA2]);

      const pointed = await req('PATCH', `/api/v1/exams/${id}/questions/${qA1}`, instructorToken, { points: 10 });
      expect(pointed.json().exam.totalPoints).toBe(14);
      expect((await req('PATCH', `/api/v1/exams/${id}/questions/${qA1}`, instructorToken, { points: 0 })).statusCode).toBe(400);
      expect((await req('PATCH', `/api/v1/exams/${id}/questions/${qB}`, instructorToken, { points: 1 })).statusCode).toBe(404);

      const removed = await req('DELETE', `/api/v1/exams/${id}/questions/${qGeneral}`, instructorToken);
      expect(removed.json().questions.map((q: { questionId: string; position: number }) => [q.questionId, q.position])).toEqual([
        [qA1, 1],
        [qA2, 2],
      ]);
    });
  });

  describe('publishing', () => {
    it('requires questions and a valid random selection to publish', async () => {
      const id = (await createExam()).json().exam.id;
      const empty = await req('PATCH', `/api/v1/exams/${id}`, instructorToken, { status: 'PUBLISHED' });
      expect(empty.statusCode).toBe(409);
      expect(empty.json().error.code).toBe('EXAM_NOT_PUBLISHABLE');

      await req('POST', `/api/v1/exams/${id}/questions`, instructorToken, { questionIds: [qA1, qA2] });
      expect((await req('PATCH', `/api/v1/exams/${id}`, instructorToken, { status: 'PUBLISHED', randomQuestionCount: 3 })).statusCode).toBe(409);
      // Başarısız yayın girişimi hiçbir alanı değiştirmemiş olmalı.
      const unchanged = (await req('GET', `/api/v1/exams/${id}`, instructorToken)).json().exam;
      expect(unchanged).toMatchObject({ status: 'DRAFT', randomQuestionCount: null });

      const published = await req('PATCH', `/api/v1/exams/${id}`, instructorToken, { status: 'PUBLISHED', randomQuestionCount: 2 });
      expect(published.json().exam.status).toBe('PUBLISHED');
    });

    it('rolls back edits that would leave a published exam invalid', async () => {
      const id = (await createExam()).json().exam.id;
      await req('POST', `/api/v1/exams/${id}/questions`, instructorToken, { questionIds: [qA1] });
      await req('PATCH', `/api/v1/exams/${id}`, instructorToken, { status: 'PUBLISHED' });

      const res = await req('DELETE', `/api/v1/exams/${id}/questions/${qA1}`, instructorToken);
      expect(res.statusCode).toBe(409);
      expect(await prisma.examQuestion.count({ where: { examId: id } })).toBe(1);

      // Taslağa alınınca serbestçe düzenlenebilir.
      await req('PATCH', `/api/v1/exams/${id}`, instructorToken, { status: 'DRAFT' });
      expect((await req('DELETE', `/api/v1/exams/${id}/questions/${qA1}`, instructorToken)).statusCode).toBe(200);
    });
  });

  describe('candidates', () => {
    it('lists enrolled students and only accepts enrolled ones', async () => {
      const id = (await createExam()).json().exam.id;
      const list = await req('GET', `/api/v1/exams/${id}/candidates`, instructorToken);
      expect(list.json()).toMatchObject({ audience: 'COURSE' });
      // Ada göre sıralı (a-student, b-student).
      expect(list.json().students.map((s: { id: string; selected: boolean }) => [s.id, s.selected])).toEqual([
        [student2Id, false],
        [studentId, false],
      ]);

      expect((await req('PUT', `/api/v1/exams/${id}/candidates`, instructorToken, { userIds: [outsiderId] })).statusCode).toBe(400);
      const saved = await req('PUT', `/api/v1/exams/${id}/candidates`, instructorToken, { userIds: [studentId] });
      expect(saved.json().students.find((s: { id: string }) => s.id === studentId).selected).toBe(true);
    });

    it('requires a selection for SELECTED exams while published', async () => {
      const id = (await createExam()).json().exam.id;
      await req('POST', `/api/v1/exams/${id}/questions`, instructorToken, { questionIds: [qA1] });
      expect((await req('PATCH', `/api/v1/exams/${id}`, instructorToken, { audience: 'SELECTED', status: 'PUBLISHED' })).statusCode).toBe(409);

      await req('PUT', `/api/v1/exams/${id}/candidates`, instructorToken, { userIds: [studentId] });
      const published = await req('PATCH', `/api/v1/exams/${id}`, instructorToken, { audience: 'SELECTED', status: 'PUBLISHED' });
      expect(published.json().exam).toMatchObject({ status: 'PUBLISHED', audience: 'SELECTED', candidateCount: 1 });

      expect((await req('PUT', `/api/v1/exams/${id}/candidates`, instructorToken, { userIds: [] })).statusCode).toBe(409);
      expect(await prisma.examCandidate.count({ where: { examId: id } })).toBe(1);
    });
  });

  describe('GET /exams/my', () => {
    it('shows published exams of enrolled courses to their audience without questions', async () => {
      const everyone = (await createExam(instructorToken, { title: 'Herkese', durationMinutes: 30 })).json().exam.id;
      const selected = (await createExam(instructorToken, { title: 'Seçili' })).json().exam.id;
      await createExam(instructorToken, { title: 'Taslak' });
      for (const id of [everyone, selected]) {
        await req('POST', `/api/v1/exams/${id}/questions`, instructorToken, { questionIds: [qA1, qA2] });
      }
      await req('PUT', `/api/v1/exams/${selected}/candidates`, instructorToken, { userIds: [student2Id] });
      await req('PATCH', `/api/v1/exams/${everyone}`, instructorToken, { status: 'PUBLISHED', randomQuestionCount: 1 });
      await req('PATCH', `/api/v1/exams/${selected}`, instructorToken, { status: 'PUBLISHED', audience: 'SELECTED' });

      const titles = async (token: string) =>
        (await req('GET', '/api/v1/exams/my', token)).json().exams.map((e: { title: string }) => e.title).sort();
      expect(await titles(studentToken)).toEqual(['Herkese']);
      expect(await titles(student2Token)).toEqual(['Herkese', 'Seçili']);
      expect(await titles(outsiderToken)).toEqual([]);

      const body = (await req('GET', '/api/v1/exams/my', studentToken)).json();
      expect(body.serverTime).toBeTruthy();
      expect(body.exams[0]).toMatchObject({ title: 'Herkese', questionCount: 1, durationMinutes: 30, availability: 'OPEN' });
      expect(Object.keys(body.exams[0])).not.toContain('questions');
      expect(JSON.stringify(body)).not.toContain('correctAnswer');
    });

    it('orders open, then upcoming, then closed exams', async () => {
      const make = async (title: string, startsAt: Date | null, endsAt: Date | null) => {
        const exam = await prisma.exam.create({ data: { title, courseId: courseA, status: 'PUBLISHED', startsAt, endsAt } });
        await prisma.examQuestion.create({ data: { examId: exam.id, questionId: qA1, position: 1 } });
      };
      const now = Date.now();
      await make('Kapandı', new Date(now - 3 * HOUR), new Date(now - HOUR));
      await make('Yaklaşan', new Date(now + HOUR), null);
      await make('Açık', new Date(now - HOUR), new Date(now + HOUR));
      const exams = (await req('GET', '/api/v1/exams/my', studentToken)).json().exams;
      expect(exams.map((e: { title: string; availability: string }) => [e.title, e.availability])).toEqual([
        ['Açık', 'OPEN'],
        ['Yaklaşan', 'UPCOMING'],
        ['Kapandı', 'CLOSED'],
      ]);
    });
  });
});

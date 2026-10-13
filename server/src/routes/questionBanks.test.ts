import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';

const singleChoice = {
  type: 'SINGLE_CHOICE',
  stem: 'Türkiye’nin başkenti neresidir?',
  content: {
    options: [
      { text: 'Ankara', correct: true },
      { text: 'İstanbul' },
    ],
  },
  topic: 'Coğrafya',
  difficulty: 'EASY',
  points: 2,
};

describe('question bank routes', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let instructorToken: string;
  let studentToken: string;
  let courseA: string; // eğitmen atanmış
  let courseB: string;

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const req = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, token: string, payload?: unknown) =>
    app.inject({ method, url, headers: auth(token), payload: payload as Record<string, unknown> | undefined });

  async function bank(name: string, courseId: string | null) {
    return prisma.questionBank.create({ data: { name, courseId } });
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
    const student = await makeUser('student@example.com', 'STUDENT');
    adminToken = signToken({ userId: admin.id, role: 'ADMIN', roles: ['ADMIN'] });
    instructorToken = signToken({ userId: instructor.id, role: 'INSTRUCTOR', roles: ['INSTRUCTOR'] });
    studentToken = signToken({ userId: student.id, role: 'STUDENT', roles: ['STUDENT'] });

    const makeCourse = (title: string) =>
      prisma.course.create({ data: { title, description: 'A', category: 'T', level: 'B', status: 'PUBLISHED' } });
    courseA = (await makeCourse('Kurs A')).id;
    courseB = (await makeCourse('Kurs B')).id;
    await prisma.courseInstructor.create({ data: { courseId: courseA, userId: instructor.id, position: 1 } });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('banks', () => {
    it('is staff-only', async () => {
      expect((await req('GET', '/api/v1/question-banks', studentToken)).statusCode).toBe(403);
    });

    it('instructors see general and their own course banks; admins see all', async () => {
      await bank('Genel', null);
      await bank('A bankası', courseA);
      await bank('B bankası', courseB);
      const names = async (token: string) =>
        (await req('GET', '/api/v1/question-banks', token)).json().banks.map((b: { name: string }) => b.name).sort();
      expect(await names(instructorToken)).toEqual(['A bankası', 'Genel']);
      expect(await names(adminToken)).toEqual(['A bankası', 'B bankası', 'Genel']);

      const banks = (await req('GET', '/api/v1/question-banks', instructorToken)).json().banks;
      const editable = Object.fromEntries(banks.map((b: { name: string; canEdit: boolean }) => [b.name, b.canEdit]));
      expect(editable).toEqual({ 'A bankası': true, Genel: false });
    });

    it('enforces who may create which bank', async () => {
      expect((await req('POST', '/api/v1/question-banks', instructorToken, { name: 'G' })).statusCode).toBe(403);
      expect((await req('POST', '/api/v1/question-banks', instructorToken, { name: 'B', courseId: courseB })).statusCode).toBe(403);
      const created = await req('POST', '/api/v1/question-banks', instructorToken, { name: ' A ', courseId: courseA });
      expect(created.statusCode).toBe(201);
      expect(created.json().bank).toMatchObject({ name: 'A', course: { id: courseA }, questionCount: 0, canEdit: true });
      expect((await req('POST', '/api/v1/question-banks', adminToken, { name: 'Genel' })).statusCode).toBe(201);
      expect((await req('POST', '/api/v1/question-banks', adminToken, { name: '' })).statusCode).toBe(400);
      expect((await req('POST', '/api/v1/question-banks', adminToken, { name: 'x', courseId: 'yok' })).statusCode).toBe(404);
    });

    it('hides other courses’ banks and keeps the course immutable', async () => {
      const other = await bank('B', courseB);
      expect((await req('GET', `/api/v1/question-banks/${other.id}`, instructorToken)).statusCode).toBe(404);
      const own = await bank('A', courseA);
      expect((await req('PATCH', `/api/v1/question-banks/${own.id}`, instructorToken, { courseId: courseB })).statusCode).toBe(400);
      const renamed = await req('PATCH', `/api/v1/question-banks/${own.id}`, instructorToken, { name: 'Yeni ad', description: 'Açıklama' });
      expect(renamed.json().bank).toMatchObject({ name: 'Yeni ad', description: 'Açıklama' });
    });

    it('refuses to delete a bank whose questions are used in an exam; otherwise deletes questions too', async () => {
      const own = await bank('A', courseA);
      const question = await req('POST', `/api/v1/question-banks/${own.id}/questions`, instructorToken, singleChoice);
      const exam = await prisma.exam.create({ data: { title: 'S', courseId: courseA } });
      await prisma.examQuestion.create({ data: { examId: exam.id, questionId: question.json().question.id, position: 1 } });

      const blocked = await req('DELETE', `/api/v1/question-banks/${own.id}`, instructorToken);
      expect(blocked.statusCode).toBe(409);
      expect(blocked.json().error.code).toBe('BANK_IN_USE');

      await prisma.examQuestion.deleteMany();
      expect((await req('DELETE', `/api/v1/question-banks/${own.id}`, instructorToken)).json()).toEqual({ deleted: true });
      expect(await prisma.question.count()).toBe(0);
    });
  });

  describe('questions', () => {
    it('creates and lists questions with the answer key for staff', async () => {
      const own = await bank('A', courseA);
      const created = await req('POST', `/api/v1/question-banks/${own.id}/questions`, instructorToken, singleChoice);
      expect(created.statusCode).toBe(201);
      expect(created.json().question).toMatchObject({
        type: 'SINGLE_CHOICE',
        topic: 'Coğrafya',
        difficulty: 'EASY',
        points: 2,
        usageCount: 0,
        bank: { id: own.id, name: 'A' },
        canEdit: true,
      });
      const listed = (await req('GET', `/api/v1/question-banks/${own.id}/questions`, instructorToken)).json().questions;
      expect(listed).toHaveLength(1);
      expect(listed[0].content.options.find((o: { correct: boolean }) => o.correct).text).toBe('Ankara');
    });

    it('lets instructors read but not modify general banks', async () => {
      const general = await bank('Genel', null);
      expect((await req('POST', `/api/v1/question-banks/${general.id}/questions`, instructorToken, singleChoice)).statusCode).toBe(403);
      const created = await req('POST', `/api/v1/question-banks/${general.id}/questions`, adminToken, singleChoice);
      const id = created.json().question.id;
      const listed = (await req('GET', `/api/v1/question-banks/${general.id}/questions`, instructorToken)).json().questions;
      expect(listed[0].canEdit).toBe(false);
      expect((await req('PATCH', `/api/v1/questions/${id}`, instructorToken, { topic: 'x' })).statusCode).toBe(403);
      expect((await req('DELETE', `/api/v1/questions/${id}`, instructorToken)).statusCode).toBe(403);
    });

    it('patches metadata without touching content and requires content when the type changes', async () => {
      const own = await bank('A', courseA);
      const id = (await req('POST', `/api/v1/question-banks/${own.id}/questions`, instructorToken, singleChoice)).json().question.id;

      const patched = await req('PATCH', `/api/v1/questions/${id}`, instructorToken, { topic: 'Başkentler', points: 5 });
      expect(patched.json().question).toMatchObject({ topic: 'Başkentler', points: 5, type: 'SINGLE_CHOICE' });
      expect(patched.json().question.content.options).toHaveLength(2);

      expect((await req('PATCH', `/api/v1/questions/${id}`, instructorToken, { type: 'TRUE_FALSE' })).statusCode).toBe(400);
      const changed = await req('PATCH', `/api/v1/questions/${id}`, instructorToken, {
        type: 'TRUE_FALSE',
        content: { correctAnswer: false },
      });
      expect(changed.json().question).toMatchObject({ type: 'TRUE_FALSE', content: { correctAnswer: false } });
      expect((await req('PATCH', `/api/v1/questions/${id}`, instructorToken, {})).statusCode).toBe(400);
    });

    it('refuses to delete a question used in an exam', async () => {
      const own = await bank('A', courseA);
      const id = (await req('POST', `/api/v1/question-banks/${own.id}/questions`, instructorToken, singleChoice)).json().question.id;
      const exam = await prisma.exam.create({ data: { title: 'S', courseId: courseA } });
      await prisma.examQuestion.create({ data: { examId: exam.id, questionId: id, position: 1 } });

      const res = await req('DELETE', `/api/v1/questions/${id}`, instructorToken);
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('QUESTION_IN_USE');

      await prisma.examQuestion.deleteMany();
      expect((await req('DELETE', `/api/v1/questions/${id}`, instructorToken)).json()).toEqual({ deleted: true });
      expect((await req('DELETE', `/api/v1/questions/${id}`, instructorToken)).statusCode).toBe(404);
    });
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';

describe('student exam attempts', () => {
  let app: FastifyInstance;
  let userId: string;
  let otherId: string;
  let token: string;
  let otherToken: string;
  let adminToken: string;
  let courseId: string;
  let lessonId: string;
  let examId: string;
  let bankId: string;
  let questionId: string;

  const req = (method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, payload?: unknown, session = token) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${session}` }, payload: payload as Record<string, unknown> | undefined });
  const start = () => req('POST', `/api/v1/exams/${examId}/attempts`);
  const current = () => req('GET', `/api/v1/exams/${examId}/attempts/current`);
  const submit = (id: string, answers: unknown) => req('POST', `/api/v1/exams/${examId}/attempts/${id}/submit`, { answers });
  const save = (id: string, answers: unknown) => req('PUT', `/api/v1/exams/${examId}/attempts/${id}/answers`, { answers });
  const summary = async () => (await req('GET', '/api/v1/exams/my')).json().exams[0];

  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });
  beforeEach(async () => {
    await prisma.exam.deleteMany();
    await prisma.questionBank.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();
    const user = await prisma.user.create({ data: { email: 'exam-student@example.com', passwordHash: 'x', name: 'Öğrenci' } });
    const other = await prisma.user.create({ data: { email: 'exam-other@example.com', passwordHash: 'x', name: 'Diğer' } });
    const admin = await prisma.user.create({ data: { email: 'exam-admin@example.com', passwordHash: 'x', name: 'Yönetici', role: 'ADMIN', roles: 'ADMIN' } });
    userId = user.id;
    otherId = other.id;
    token = signToken({ userId, role: 'STUDENT', roles: ['STUDENT'] });
    otherToken = signToken({ userId: otherId, role: 'STUDENT', roles: ['STUDENT'] });
    adminToken = signToken({ userId: admin.id, role: 'ADMIN', roles: ['ADMIN'] });
    const course = await prisma.course.create({ data: { title: 'Temel programlama', description: 'Kurs', category: 'Yazılım', level: 'Başlangıç', status: 'PUBLISHED' } });
    courseId = course.id;
    await prisma.enrollment.create({ data: { courseId, userId, method: 'OPEN' } });
    const module = await prisma.module.create({ data: { courseId, title: 'Temel kavramlar', order: 1 } });
    lessonId = (await prisma.lesson.create({ data: { moduleId: module.id, title: 'Değişkenler', order: 1, status: 'PUBLISHED' } })).id;
    bankId = (await prisma.questionBank.create({ data: { name: 'Kurs soruları', courseId } })).id;
    questionId = (await prisma.question.create({ data: { bankId, type: 'TRUE_FALSE', stem: 'Değişkenler veri saklar.', content: JSON.stringify({ correctAnswer: true }), explanation: 'Değişkenler değer saklamak için kullanılır.' } })).id;
    examId = (await prisma.exam.create({ data: { courseId, title: 'Eğitim sonu sınavı', status: 'PUBLISHED', requiresCourseCompletion: true, passingScore: 60, durationMinutes: 10, learningObjectives: JSON.stringify(['Değişkenleri tanımak']) } })).id;
    await prisma.examQuestion.create({ data: { examId, questionId, position: 1, points: 5 } });
    await prisma.lessonProgress.create({ data: { userId, lessonId } });
  });

  it('persists and validates staff learning objectives and completion settings', async () => {
    const res = await req('PATCH', `/api/v1/exams/${examId}`, { learningObjectives: [' Döngüleri açıklamak ', 'Döngüleri açıklamak'], requiresCourseCompletion: false }, adminToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().exam).toMatchObject({ learningObjectives: ['Döngüleri açıklamak'], requiresCourseCompletion: false });
    expect((await req('PATCH', `/api/v1/exams/${examId}`, { learningObjectives: [''] }, adminToken)).statusCode).toBe(400);
    expect((await req('PATCH', `/api/v1/exams/${examId}`, { learningObjectives: 'metin' }, adminToken)).statusCode).toBe(400);
    expect((await req('PATCH', `/api/v1/exams/${examId}`, { requiresCourseCompletion: 'true' }, adminToken)).statusCode).toBe(400);
  });

  it('gates start on all published lessons and does not count a course with zero lessons as complete', async () => {
    await prisma.lessonProgress.deleteMany();
    expect(await summary()).toMatchObject({ courseCompleted: false, canStart: false, attemptsUsed: 0 });
    expect((await start()).statusCode).toBe(409);
    await prisma.lessonProgress.create({ data: { userId, lessonId } });
    await prisma.lesson.create({ data: { moduleId: (await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } })).moduleId, title: 'Taslak', order: 2 } });
    expect(await summary()).toMatchObject({ courseCompleted: true, canStart: true });
    await prisma.lesson.update({ where: { id: lessonId }, data: { status: 'DRAFT' } });
    expect((await start()).statusCode).toBe(409);
  });

  it('denies unauthenticated users, staff roles, outsiders, excluded candidates and unpublished content', async () => {
    expect((await app.inject({ method: 'POST', url: `/api/v1/exams/${examId}/attempts` })).statusCode).toBe(401);
    expect((await req('POST', `/api/v1/exams/${examId}/attempts`, undefined, adminToken)).statusCode).toBe(403);
    expect((await req('POST', `/api/v1/exams/${examId}/attempts`, undefined, otherToken)).statusCode).toBe(404);
    await prisma.exam.update({ where: { id: examId }, data: { audience: 'SELECTED' } });
    expect((await start()).statusCode).toBe(404);
    await prisma.examCandidate.create({ data: { examId, userId } });
    await prisma.course.update({ where: { id: courseId }, data: { status: 'DRAFT' } });
    expect((await start()).statusCode).toBe(404);
    expect((await req('GET', '/api/v1/exams/my')).json().exams).toEqual([]);
    await prisma.course.update({ where: { id: courseId }, data: { status: 'PUBLISHED' } });
    await prisma.exam.update({ where: { id: examId }, data: { status: 'DRAFT' } });
    expect((await start()).statusCode).toBe(404);
  });

  it('returns no attempt before start and no answer keys until submission', async () => {
    expect((await current()).json()).toEqual({ attempt: null });
    const res = await start();
    expect(res.statusCode).toBe(200);
    expect(res.json().attempt).toMatchObject({ status: 'IN_PROGRESS', learningObjectives: ['Değişkenleri tanımak'], answers: {}, result: null, questions: [{ id: questionId, content: {} }] });
    expect(res.body).not.toContain('correctAnswer');
    expect(res.body).not.toContain('explanation');
    expect(res.body).not.toContain('snapshot');
    const again = (await start()).json().attempt;
    expect(again.id).toBe(res.json().attempt.id);
    expect(again.deadlineAt).toBe(res.json().attempt.deadlineAt);
  });

  it('saves drafts, resumes and submits idempotently using immutable content and settings', async () => {
    const attempt = (await start()).json().attempt;
    expect((await save(attempt.id, { [questionId]: true })).json().attempt.answers).toEqual({ [questionId]: true });
    await prisma.question.update({ where: { id: questionId }, data: { stem: 'Yeni soru', content: JSON.stringify({ correctAnswer: false }) } });
    await prisma.exam.update({ where: { id: examId }, data: { title: 'Yeni başlık', passingScore: 100, showResults: false, durationMinutes: 1, learningObjectives: '[]' } });
    expect((await current()).json().attempt).toMatchObject({ title: 'Eğitim sonu sınavı', answers: { [questionId]: true }, questions: [{ stem: 'Değişkenler veri saklar.' }], deadlineAt: attempt.deadlineAt });
    const submitted = (await submit(attempt.id, { [questionId]: true })).json().attempt;
    expect(submitted).toMatchObject({ status: 'SUBMITTED', result: { score: 100, earnedPoints: 5, totalPoints: 5, passed: true, feedback: [{ questionId, correct: true, correctAnswer: true }] } });
    expect((await submit(attempt.id, { [questionId]: false })).json().attempt).toEqual(submitted);
    expect((await save(attempt.id, { [questionId]: false })).json().attempt).toEqual(submitted);
    expect(await summary()).toMatchObject({ attemptsUsed: 1, canStart: false, latestResult: { score: 100, passed: true } });
    expect((await start()).statusCode).toBe(409);
  });

  it('does not expose another student attempt even to an enrolled student', async () => {
    const attempt = (await start()).json().attempt;
    await prisma.enrollment.create({ data: { userId: otherId, courseId, method: 'OPEN' } });
    expect((await req('POST', `/api/v1/exams/${examId}/attempts/${attempt.id}/submit`, { answers: { [questionId]: true } }, otherToken)).statusCode).toBe(404);
    expect((await req('GET', `/api/v1/exams/${examId}/attempts/current`, undefined, otherToken)).json()).toEqual({ attempt: null });
  });

  it('enforces windows and calculates the earlier of duration and exam end', async () => {
    await prisma.exam.update({ where: { id: examId }, data: { startsAt: new Date(Date.now() + 60000) } });
    expect((await start()).statusCode).toBe(409);
    const endsAt = new Date(Date.now() + 120000);
    await prisma.exam.update({ where: { id: examId }, data: { startsAt: null, endsAt } });
    const attempt = (await start()).json().attempt;
    expect(attempt.deadlineAt).toBe(endsAt.toISOString());
    await prisma.exam.update({ where: { id: examId }, data: { endsAt: new Date(Date.now() - 1000) } });
    // An in-progress attempt retains its original deadline after staff edits.
    expect((await start()).json().attempt.id).toBe(attempt.id);
  });

  it('finalizes timed out saved work and ignores new answers after the deadline', async () => {
    const attempt = (await start()).json().attempt;
    await save(attempt.id, { [questionId]: false });
    await prisma.examAttempt.update({ where: { id: attempt.id }, data: { deadlineAt: new Date(Date.now() - 1) } });
    const late = await submit(attempt.id, { [questionId]: true });
    expect(late.json().attempt).toMatchObject({ status: 'SUBMITTED', answers: { [questionId]: false }, result: { score: 0, passed: false } });
    expect((await current()).json().attempt.status).toBe('SUBMITTED');
  });

  it('finalizes expiration from the list and permits another attempt only within the limit', async () => {
    await prisma.exam.update({ where: { id: examId }, data: { maxAttempts: 2 } });
    const first = (await start()).json().attempt;
    await save(first.id, { [questionId]: true });
    await prisma.examAttempt.update({ where: { id: first.id }, data: { deadlineAt: new Date(Date.now() - 1) } });
    expect(await summary()).toMatchObject({ attemptsUsed: 1, canStart: true, latestResult: { score: 100, passed: true } });
    const second = (await start()).json().attempt;
    expect(second.id).not.toBe(first.id);
    await submit(second.id, {});
    expect((await start()).statusCode).toBe(409);
    expect(await prisma.examAttempt.count()).toBe(2);
  });

  it('blocks unsupported questions before consuming a trial', async () => {
    await prisma.question.update({ where: { id: questionId }, data: { type: 'ESSAY', content: JSON.stringify({ rubric: null }) } });
    expect(await summary()).toMatchObject({ canStart: false, attemptsUsed: 0 });
    expect((await start()).statusCode).toBe(409);
    expect(await prisma.examAttempt.count()).toBe(0);
  });

  it('grades all supported question types with Turkish text normalization and weighted points', async () => {
    const definitions = [
      { type: 'SINGLE_CHOICE', stem: 'Tek seçim', content: { options: [{ id: 'a', text: 'Doğru', correct: true }, { id: 'b', text: 'Yanlış', correct: false }] }, answer: 'a', points: 2 },
      { type: 'MULTIPLE_CHOICE', stem: 'Çoklu seçim', content: { options: [{ id: 'a', text: 'Bir', correct: true }, { id: 'b', text: 'İki', correct: true }, { id: 'c', text: 'Üç', correct: false }] }, answer: ['b', 'a'], points: 3 },
      { type: 'SHORT_ANSWER', stem: 'Kısa cevap', content: { accepted: ['İSTANBUL'], caseSensitive: false }, answer: ' istanbul ', points: 4 },
      { type: 'FILL_BLANK', stem: '___ ve ___', content: { blanks: [{ accepted: ['İstanbul'] }, { accepted: ['Ankara'] }], caseSensitive: false }, answer: ['istanbul', 'ankara'], points: 6 },
    ];
    const answers: Record<string, string | boolean | string[]> = { [questionId]: false };
    for (const [index, definition] of definitions.entries()) {
      const question = await prisma.question.create({ data: { bankId, type: definition.type, stem: definition.stem, content: JSON.stringify(definition.content) } });
      await prisma.examQuestion.create({ data: { examId, questionId: question.id, position: index + 2, points: definition.points } });
      answers[question.id] = definition.answer;
    }
    const attempt = (await start()).json().attempt;
    expect(attempt.questions[1].content.options).toEqual([{ id: 'a', text: 'Doğru' }, { id: 'b', text: 'Yanlış' }]);
    expect(attempt.questions[4].content).toEqual({ blankCount: 2 });
    const result = (await submit(attempt.id, answers)).json().attempt.result;
    expect(result).toMatchObject({ score: 75, earnedPoints: 15, totalPoints: 20, passed: true });
    expect(result.feedback.map((item: { correct: boolean }) => item.correct)).toEqual([false, true, true, true, true]);
  });

  it('hides answer feedback when disabled but still returns the score', async () => {
    await prisma.exam.update({ where: { id: examId }, data: { showResults: false, passingScore: null } });
    const attempt = (await start()).json().attempt;
    const res = await submit(attempt.id, { [questionId]: true });
    expect(res.json().attempt.result).toMatchObject({ score: 100, passed: null, feedback: null });
    expect(res.body).not.toContain('correctAnswer');
    expect(res.body).not.toContain('explanation');
  });

  it('rejects unknown question IDs and invalid answer shapes', async () => {
    const attempt = (await start()).json().attempt;
    expect((await submit(attempt.id, { unknown: true })).statusCode).toBe(400);
    expect((await submit(attempt.id, { [questionId]: 'true' })).statusCode).toBe(400);
    expect((await submit(attempt.id, [])).statusCode).toBe(400);
    expect((await current()).json().attempt.status).toBe('IN_PROGRESS');
  });

  it('selects the configured number of questions and persists shuffling across resumes', async () => {
    for (let index = 0; index < 5; index++) {
      const q = await prisma.question.create({ data: { bankId, type: 'TRUE_FALSE', stem: `Soru ${index}`, content: JSON.stringify({ correctAnswer: true }) } });
      await prisma.examQuestion.create({ data: { examId, questionId: q.id, position: index + 2 } });
    }
    await prisma.exam.update({ where: { id: examId }, data: { randomQuestionCount: 3, shuffleQuestions: true, shuffleOptions: true } });
    const attempt = (await start()).json().attempt;
    expect(attempt.questions).toHaveLength(3);
    expect(new Set(attempt.questions.map((q: { id: string }) => q.id)).size).toBe(3);
    expect((await current()).json().attempt.questions).toEqual(attempt.questions);
  });

  it('creates only one active attempt for concurrent starts and finalizes concurrent submissions once', async () => {
    const starts = await Promise.all([start(), start(), start()]);
    expect(starts.map((res) => res.statusCode)).toEqual([200, 200, 200]);
    expect(new Set(starts.map((res) => res.json().attempt.id)).size).toBe(1);
    expect(await prisma.examAttempt.count()).toBe(1);
    const id = starts[0].json().attempt.id;
    const submits = await Promise.all([submit(id, { [questionId]: true }), submit(id, { [questionId]: false })]);
    expect(submits.map((res) => res.statusCode)).toEqual([200, 200]);
    expect(submits[0].json().attempt).toEqual(submits[1].json().attempt);
  });
});

import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { attemptDeadline, courseCompleted, expireAttempt, finalizeAttempt, loadStudentExam, makeSnapshot, parseAnswers, serializeAttempt, startBlockedReason } from '../lib/examAttempts.js';

export function registerExamAttemptRoutes(app: FastifyInstance) {
  const student = { preHandler: [requireAuth, requireRole('STUDENT')] };

  app.post<{ Params: { id: string } }>('/api/v1/exams/:id/attempts', student, async (request) => {
    const { id } = request.params;
    const userId = request.user!.userId;
    const attempt = await prisma.$transaction(async (tx) => {
      // SQLite allows one writer. Acquire its write lock before counting/creating,
      // including across processes; the unique active-attempt index is a second guard.
      await tx.$executeRaw`UPDATE "Exam" SET "id" = "id" WHERE "id" = ${id}`;
      const exam = await loadStudentExam(tx, id, userId);
      const now = new Date();
      const latest = await tx.examAttempt.findFirst({ where: { examId: id, userId }, orderBy: { number: 'desc' } });
      if (latest?.status === 'IN_PROGRESS') return (await expireAttempt(tx, latest, now))!;
      const completed = await courseCompleted(tx, exam.courseId, userId);
      const used = await tx.examAttempt.count({ where: { examId: id, userId } });
      const reason = await startBlockedReason(tx, exam, completed, used, now);
      if (reason) throw new AppError('EXAM_START_BLOCKED', reason, 409);
      return tx.examAttempt.create({
        data: { examId: id, userId, number: used + 1, startedAt: now, deadlineAt: attemptDeadline(exam, now), snapshot: JSON.stringify(await makeSnapshot(tx, exam)) },
      });
    }, { timeout: 10000 });
    return { attempt: serializeAttempt(attempt) };
  });

  app.get<{ Params: { id: string } }>('/api/v1/exams/:id/attempts/current', student, async (request) => {
    const { id } = request.params;
    const userId = request.user!.userId;
    const attempt = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "Exam" SET "id" = "id" WHERE "id" = ${id}`;
      await loadStudentExam(tx, id, userId);
      const latest = await tx.examAttempt.findFirst({ where: { examId: id, userId }, orderBy: { number: 'desc' } });
      return expireAttempt(tx, latest, new Date());
    }, { timeout: 10000 });
    return { attempt: attempt ? serializeAttempt(attempt) : null };
  });

  const update = (submit: boolean) => async (request: import('fastify').FastifyRequest<{ Params: { id: string; attemptId: string }; Body: unknown }>) => {
    const { id, attemptId } = request.params;
    const userId = request.user!.userId;
    const attempt = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "Exam" SET "id" = "id" WHERE "id" = ${id}`;
      await loadStudentExam(tx, id, userId);
      const existing = await tx.examAttempt.findFirst({ where: { id: attemptId, examId: id, userId } });
      if (!existing) throw new AppError('NOT_FOUND', 'Sınav denemesi bulunamadı.', 404);
      // A repeated submission or late autosave never changes a finalized result.
      const current = (await expireAttempt(tx, existing, new Date()))!;
      if (current.status === 'SUBMITTED') return current;
      const answers = parseAnswers(request.body, current);
      if (submit) return finalizeAttempt(tx, current, answers, new Date());
      return tx.examAttempt.update({ where: { id: attemptId }, data: { answers: JSON.stringify(answers) } });
    }, { timeout: 10000 });
    return { attempt: serializeAttempt(attempt) };
  };
  app.put<{ Params: { id: string; attemptId: string }; Body: unknown }>('/api/v1/exams/:id/attempts/:attemptId/answers', student, update(false));
  app.post<{ Params: { id: string; attemptId: string }; Body: unknown }>('/api/v1/exams/:id/attempts/:attemptId/submit', student, update(true));
}

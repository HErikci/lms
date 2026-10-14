import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { AppError } from '../errors.js';
import { assertCanManageCourse, assignedCourseIds } from '../lib/courseAccess.js';
import { courseCompleted, expireAttempt, startBlockedReason } from '../lib/examAttempts.js';
import {
  EXAM_SETTING_FIELDS,
  effectiveQuestionCount,
  examAvailability,
  normalizeExamSettings,
  publishProblems,
  toRawSettings,
  type RawExamSettings,
} from '../lib/exams.js';
import {
  QUESTION_LIMITS,
  canEditBank,
  canReadBank,
  questionInclude,
  serializeQuestion,
} from '../lib/questions.js';

type AuthUser = NonNullable<Parameters<typeof assertCanManageCourse>[0]>;
type Db = Prisma.TransactionClient;

const MAX_IDS = 1000;

const examInclude = {
  course: { select: { id: true, title: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

type ExamRow = Prisma.ExamGetPayload<{ include: typeof examInclude }>;

function validation(message: string): AppError {
  return new AppError('VALIDATION_ERROR', message, 400);
}

function requireBodyObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw validation('İstek gövdesi bir nesne olmalıdır.');
  }
  return body as Record<string, unknown>;
}

/** Benzersiz kimliklerden oluşan dizi; sıra korunur. */
function parseIdList(value: unknown, field: string, { allowEmpty }: { allowEmpty: boolean }): string[] {
  if (!Array.isArray(value)) throw validation(`${field} bir kimlik dizisi olmalıdır.`);
  if (!allowEmpty && value.length === 0) throw validation(`${field} en az bir kimlik içermelidir.`);
  if (value.length > MAX_IDS) throw validation(`${field} en fazla ${MAX_IDS} kimlik içerebilir.`);
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id !== 'string' || id === '') throw validation(`${field} yalnızca kimlik metinleri içerebilir.`);
    if (seen.has(id)) throw validation(`${field} tekrar eden kimlik içeremez.`);
    seen.add(id);
  }
  return value as string[];
}

function parsePoints(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < QUESTION_LIMITS.minPoints ||
    value > QUESTION_LIMITS.maxPoints
  ) {
    throw validation(`Puan ${QUESTION_LIMITS.minPoints} ile ${QUESTION_LIMITS.maxPoints} arasında bir tam sayı olmalıdır.`);
  }
  return value;
}

async function loadManagedExam(user: AuthUser, id: string): Promise<ExamRow> {
  const exam = await prisma.exam.findUnique({ where: { id }, include: examInclude });
  if (!exam) throw new AppError('NOT_FOUND', 'Sınav bulunamadı.', 404);
  await assertCanManageCourse(user, exam.courseId);
  return exam;
}

/** "Seçili öğrenciler" modunda sayılan adaylar: yalnızca hâlâ kursa kayıtlı olanlar. */
function enrolledCandidateCount(db: Db, examId: string, courseId: string): Promise<number> {
  return db.examCandidate.count({
    where: { examId, user: { enrollments: { some: { courseId } } } },
  });
}

/** Sınava girebilecek öğrenci sayısı (audience'a göre). */
async function candidateCount(db: Db, exam: { id: string; courseId: string; audience: string }): Promise<number> {
  return exam.audience === 'SELECTED'
    ? enrolledCandidateCount(db, exam.id, exam.courseId)
    : db.enrollment.count({ where: { courseId: exam.courseId } });
}

/**
 * Yayındaki sınav değiştirildikten sonra (aynı transaction içinde) çağrılır: sınav artık
 * yayınlanabilir değilse hata fırlatır ve transaction geri alınır.
 */
async function assertPublishedStillValid(tx: Db, examId: string): Promise<void> {
  const exam = await tx.exam.findUniqueOrThrow({
    where: { id: examId },
    select: {
      id: true,
      status: true,
      courseId: true,
      audience: true,
      randomQuestionCount: true,
      _count: { select: { questions: true } },
    },
  });
  if (exam.status !== 'PUBLISHED') return;
  const problems = publishProblems({
    questionCount: exam._count.questions,
    randomQuestionCount: exam.randomQuestionCount,
    audience: exam.audience,
    candidateCount: exam.audience === 'SELECTED' ? await enrolledCandidateCount(tx, exam.id, exam.courseId) : 0,
  });
  if (problems.length > 0) {
    throw new AppError('EXAM_NOT_PUBLISHABLE', `Sınav yayında kalamaz: ${problems.join(' ')}`, 409);
  }
}

function serializeExam(
  exam: ExamRow,
  stats: { questionCount: number; totalPoints: number; candidateCount: number },
  now: Date,
) {
  return {
    id: exam.id,
    title: exam.title,
    description: exam.description,
    type: exam.type,
    status: exam.status,
    course: { id: exam.course.id, title: exam.course.title },
    startsAt: exam.startsAt?.toISOString() ?? null,
    endsAt: exam.endsAt?.toISOString() ?? null,
    durationMinutes: exam.durationMinutes,
    maxAttempts: exam.maxAttempts,
    passingScore: exam.passingScore,
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
    randomQuestionCount: exam.randomQuestionCount,
    showResults: exam.showResults,
    audience: exam.audience,
    learningObjectives: JSON.parse(exam.learningObjectives) as string[],
    requiresCourseCompletion: exam.requiresCourseCompletion,
    availability: examAvailability(exam, now),
    questionCount: stats.questionCount,
    totalPoints: stats.totalPoints,
    candidateCount: stats.candidateCount,
    createdBy: exam.createdBy ? { id: exam.createdBy.id, name: exam.createdBy.name } : null,
    createdAt: exam.createdAt.toISOString(),
    updatedAt: exam.updatedAt.toISOString(),
  };
}

/** Yönetim ayrıntısı: ayarlar + sıralı sorular (doğru cevaplarla). Transaction dışında çağrılır. */
async function buildExamDetail(user: AuthUser, examId: string) {
  const now = new Date();
  const [exam, links, assigned] = await Promise.all([
    prisma.exam.findUniqueOrThrow({ where: { id: examId }, include: examInclude }),
    prisma.examQuestion.findMany({
      where: { examId },
      include: { question: { include: questionInclude } },
      orderBy: { position: 'asc' },
    }),
    assignedCourseIds(user),
  ]);
  const candidates = await candidateCount(prisma, exam);
  return {
    exam: serializeExam(
      exam,
      {
        questionCount: links.length,
        totalPoints: links.reduce((sum, link) => sum + link.points, 0),
        candidateCount: candidates,
      },
      now,
    ),
    questions: links.map((link) => ({
      questionId: link.questionId,
      position: link.position,
      points: link.points,
      question: serializeQuestion(link.question, canEditBank(user, link.question.bank.courseId, assigned)),
    })),
  };
}

async function buildCandidateList(examId: string) {
  const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId }, select: { courseId: true, audience: true } });
  const [enrollments, selected] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId: exam.courseId },
      select: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
    prisma.examCandidate.findMany({ where: { examId }, select: { userId: true } }),
  ]);
  const selectedIds = new Set(selected.map((row) => row.userId));
  return {
    audience: exam.audience,
    students: enrollments
      .map(({ user }) => ({ ...user, selected: selectedIds.has(user.id) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr')),
  };
}

const AVAILABILITY_ORDER = { OPEN: 0, UPCOMING: 1, CLOSED: 2 } as const;

export function registerExamRoutes(app: FastifyInstance) {
  const staff = { preHandler: [requireAuth, requireRole('ADMIN', 'INSTRUCTOR')] };

  // Öğrencinin girebileceği yayındaki sınavlar. Sorular ve cevaplar dönmez (NFR-80).
  app.get('/api/v1/exams/my', { preHandler: [requireAuth] }, async (request) => {
    const userId = request.user!.userId;
    const now = new Date();
    const enrollments = await prisma.enrollment.findMany({ where: { userId }, select: { courseId: true } });
    const exams = await prisma.exam.findMany({
      where: {
        status: 'PUBLISHED',
        course: { status: 'PUBLISHED' },
        courseId: { in: enrollments.map((row) => row.courseId) },
        OR: [{ audience: 'COURSE' }, { candidates: { some: { userId } } }],
      },
      include: { course: { select: { id: true, title: true } }, _count: { select: { questions: true } } },
    });

    const items = [];
    for (const exam of exams) {
      const progress = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE "Exam" SET "id" = "id" WHERE "id" = ${exam.id}`;
        const completed = await courseCompleted(tx, exam.courseId, userId);
        const attemptsUsed = await tx.examAttempt.count({ where: { examId: exam.id, userId } });
        const latestRow = await tx.examAttempt.findFirst({ where: { examId: exam.id, userId }, orderBy: { number: 'desc' } });
        const latest = await expireAttempt(tx, latestRow, new Date());
        const reason = latest?.status === 'IN_PROGRESS' ? null : await startBlockedReason(tx, exam, completed, attemptsUsed, now);
        const latestSubmitted = latest?.status === 'SUBMITTED' ? latest : await tx.examAttempt.findFirst({
          where: { examId: exam.id, userId, status: 'SUBMITTED' }, orderBy: { number: 'desc' },
        });
        const latestResult = latestSubmitted?.result ? JSON.parse(latestSubmitted.result) as { score: number; passed: boolean | null } : null;
        return {
          courseCompleted: completed,
          attemptsUsed,
          canStart: reason === null,
          startBlockedReason: reason,
          latestResult: latestResult ? { score: latestResult.score, passed: latestResult.passed } : null,
        };
      }, { timeout: 10000 });
      items.push({
        id: exam.id,
        title: exam.title,
        description: exam.description,
        type: exam.type,
        course: exam.course,
        startsAt: exam.startsAt?.toISOString() ?? null,
        endsAt: exam.endsAt?.toISOString() ?? null,
        durationMinutes: exam.durationMinutes,
        maxAttempts: exam.maxAttempts,
        passingScore: exam.passingScore,
        questionCount: effectiveQuestionCount(exam.randomQuestionCount, exam._count.questions),
        availability: examAvailability(exam, now),
        learningObjectives: JSON.parse(exam.learningObjectives) as string[],
        requiresCourseCompletion: exam.requiresCourseCompletion,
        ...progress,
      });
    }
    // Açık olanlar önce (en erken kapanan başta), sonra yaklaşanlar (en erken açılan), en son kapananlar (en yeni).
    const time = (iso: string | null, fallback: number) => (iso ? Date.parse(iso) : fallback);
    items.sort((a, b) => {
      const byState = AVAILABILITY_ORDER[a.availability] - AVAILABILITY_ORDER[b.availability];
      if (byState !== 0) return byState;
      if (a.availability === 'OPEN') return time(a.endsAt, Infinity) - time(b.endsAt, Infinity);
      if (a.availability === 'UPCOMING') return time(a.startsAt, 0) - time(b.startsAt, 0);
      return time(b.endsAt, 0) - time(a.endsAt, 0);
    });
    return { exams: items, serverTime: now.toISOString() };
  });

  app.get<{ Querystring: { courseId?: string; status?: string } }>(
    '/api/v1/exams/manage',
    staff,
    async (request) => {
      const user = request.user!;
      const now = new Date();
      const { courseId, status } = request.query;
      if (status && status !== 'DRAFT' && status !== 'PUBLISHED') {
        throw validation('status DRAFT veya PUBLISHED olmalıdır.');
      }
      const assigned = await assignedCourseIds(user);
      const exams = await prisma.exam.findMany({
        where: {
          AND: [
            user.role === 'ADMIN' ? {} : { courseId: { in: [...assigned] } },
            courseId ? { courseId } : {},
            status ? { status } : {},
          ],
        },
        include: { ...examInclude, _count: { select: { questions: true } } },
        orderBy: [{ updatedAt: 'desc' }],
      });

      const examIds = exams.map((exam) => exam.id);
      const courseIds = [...new Set(exams.map((exam) => exam.courseId))];
      const [pointSums, enrollments, candidates] = await Promise.all([
        prisma.examQuestion.groupBy({ by: ['examId'], where: { examId: { in: examIds } }, _sum: { points: true } }),
        prisma.enrollment.findMany({ where: { courseId: { in: courseIds } }, select: { courseId: true, userId: true } }),
        prisma.examCandidate.findMany({ where: { examId: { in: examIds } }, select: { examId: true, userId: true } }),
      ]);
      const pointsByExam = new Map(pointSums.map((row) => [row.examId, row._sum.points ?? 0]));
      const enrolled = new Set(enrollments.map((row) => `${row.courseId}:${row.userId}`));
      const enrolledPerCourse = new Map<string, number>();
      for (const row of enrollments) enrolledPerCourse.set(row.courseId, (enrolledPerCourse.get(row.courseId) ?? 0) + 1);

      return {
        exams: exams.map((exam) => {
          const selectedCount = candidates.filter(
            (row) => row.examId === exam.id && enrolled.has(`${exam.courseId}:${row.userId}`),
          ).length;
          return serializeExam(
            exam,
            {
              questionCount: exam._count.questions,
              totalPoints: pointsByExam.get(exam.id) ?? 0,
              candidateCount: exam.audience === 'SELECTED' ? selectedCount : (enrolledPerCourse.get(exam.courseId) ?? 0),
            },
            now,
          );
        }),
      };
    },
  );

  app.post<{ Body: unknown }>('/api/v1/exams', staff, async (request, reply) => {
    const user = request.user!;
    const body = requireBodyObject(request.body);
    if (typeof body.courseId !== 'string' || body.courseId === '') throw validation('courseId zorunludur.');
    const course = await prisma.course.findUnique({ where: { id: body.courseId }, select: { id: true } });
    if (!course) throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
    await assertCanManageCourse(user, course.id);

    // Yeni sınav her zaman taslaktır: soru eklenmeden yayınlanamaz.
    const settings = normalizeExamSettings({ ...(body as RawExamSettings), status: 'DRAFT' });
    const created = await prisma.exam.create({
      data: { ...settings, courseId: course.id, createdById: user.userId },
    });
    reply.status(201);
    return buildExamDetail(user, created.id);
  });

  app.get<{ Params: { id: string } }>('/api/v1/exams/:id', staff, async (request) => {
    const exam = await loadManagedExam(request.user!, request.params.id);
    return buildExamDetail(request.user!, exam.id);
  });

  app.patch<{ Params: { id: string }; Body: unknown }>('/api/v1/exams/:id', staff, async (request) => {
    const user = request.user!;
    const existing = await loadManagedExam(user, request.params.id);
    const body = requireBodyObject(request.body);
    if (body.courseId !== undefined && body.courseId !== existing.courseId) {
      throw validation('Sınavın kursu sonradan değiştirilemez; yeni bir sınav oluşturun.');
    }
    if (!EXAM_SETTING_FIELDS.some((field) => body[field] !== undefined)) {
      throw validation('Güncellenecek en az bir alan gönderilmelidir.');
    }

    const merged: Record<string, unknown> = { ...toRawSettings(existing) };
    for (const field of EXAM_SETTING_FIELDS) {
      if (body[field] !== undefined) merged[field] = body[field];
    }
    const settings = normalizeExamSettings(merged as RawExamSettings);

    await prisma.$transaction(async (tx) => {
      await tx.exam.update({ where: { id: existing.id }, data: settings });
      await assertPublishedStillValid(tx, existing.id);
    });
    return buildExamDetail(user, existing.id);
  });

  app.delete<{ Params: { id: string } }>('/api/v1/exams/:id', staff, async (request) => {
    const exam = await loadManagedExam(request.user!, request.params.id);
    await prisma.exam.deleteMany({ where: { id: exam.id } });
    return { deleted: true };
  });

  // --- Sınav soruları ---

  app.post<{ Params: { id: string }; Body: unknown }>('/api/v1/exams/:id/questions', staff, async (request) => {
    const user = request.user!;
    const exam = await loadManagedExam(user, request.params.id);
    const ids = parseIdList(requireBodyObject(request.body).questionIds, 'questionIds', { allowEmpty: false });

    const [questions, assigned] = await Promise.all([
      prisma.question.findMany({
        where: { id: { in: ids } },
        select: { id: true, points: true, bank: { select: { courseId: true } } },
      }),
      assignedCourseIds(user),
    ]);
    const byId = new Map(questions.map((question) => [question.id, question]));
    for (const id of ids) {
      const question = byId.get(id);
      // Okunamayan bankanın sorusu yokmuş gibi davranılır.
      if (!question || !canReadBank(user, question.bank.courseId, assigned)) {
        throw new AppError('NOT_FOUND', 'Soru bulunamadı.', 404);
      }
      if (question.bank.courseId !== null && question.bank.courseId !== exam.courseId) {
        throw validation('Sınava yalnızca bu kursun ve genel bankaların soruları eklenebilir.');
      }
    }

    await prisma.$transaction(async (tx) => {
      const links = await tx.examQuestion.findMany({
        where: { examId: exam.id },
        select: { questionId: true, position: true },
      });
      const present = new Set(links.map((link) => link.questionId));
      let position = links.reduce((max, link) => Math.max(max, link.position), 0);
      // Zaten ekli olanlar atlanır (işlem tekrarlanabilir).
      const rows = ids
        .filter((id) => !present.has(id))
        .map((id) => ({ examId: exam.id, questionId: id, position: ++position, points: byId.get(id)!.points }));
      if (rows.length > 0) await tx.examQuestion.createMany({ data: rows });
    });
    return buildExamDetail(user, exam.id);
  });

  app.patch<{ Params: { id: string; questionId: string }; Body: unknown }>(
    '/api/v1/exams/:id/questions/:questionId',
    staff,
    async (request) => {
      const user = request.user!;
      const exam = await loadManagedExam(user, request.params.id);
      const points = parsePoints(requireBodyObject(request.body).points);
      const { count } = await prisma.examQuestion.updateMany({
        where: { examId: exam.id, questionId: request.params.questionId },
        data: { points },
      });
      if (count === 0) throw new AppError('NOT_FOUND', 'Soru bu sınavda değil.', 404);
      return buildExamDetail(user, exam.id);
    },
  );

  app.delete<{ Params: { id: string; questionId: string } }>(
    '/api/v1/exams/:id/questions/:questionId',
    staff,
    async (request) => {
      const user = request.user!;
      const exam = await loadManagedExam(user, request.params.id);
      await prisma.$transaction(async (tx) => {
        const { count } = await tx.examQuestion.deleteMany({
          where: { examId: exam.id, questionId: request.params.questionId },
        });
        if (count === 0) throw new AppError('NOT_FOUND', 'Soru bu sınavda değil.', 404);
        // Sıra numaraları boşluksuz 1..n tutulur.
        const remaining = await tx.examQuestion.findMany({
          where: { examId: exam.id },
          orderBy: { position: 'asc' },
          select: { id: true, position: true },
        });
        for (const [index, link] of remaining.entries()) {
          if (link.position !== index + 1) {
            await tx.examQuestion.update({ where: { id: link.id }, data: { position: index + 1 } });
          }
        }
        await assertPublishedStillValid(tx, exam.id);
      });
      return buildExamDetail(user, exam.id);
    },
  );

  app.put<{ Params: { id: string }; Body: unknown }>('/api/v1/exams/:id/questions/order', staff, async (request) => {
    const user = request.user!;
    const exam = await loadManagedExam(user, request.params.id);
    const ids = parseIdList(requireBodyObject(request.body).questionIds, 'questionIds', { allowEmpty: true });

    await prisma.$transaction(async (tx) => {
      const links = await tx.examQuestion.findMany({ where: { examId: exam.id }, select: { id: true, questionId: true } });
      const byQuestion = new Map(links.map((link) => [link.questionId, link.id]));
      if (ids.length !== links.length || ids.some((id) => !byQuestion.has(id))) {
        throw validation('questionIds, sınavdaki soruların tamamını tam olarak bir kez içermelidir.');
      }
      for (const [index, questionId] of ids.entries()) {
        await tx.examQuestion.update({ where: { id: byQuestion.get(questionId)! }, data: { position: index + 1 } });
      }
    });
    return buildExamDetail(user, exam.id);
  });

  // --- Sınava girecek öğrenciler ---

  app.get<{ Params: { id: string } }>('/api/v1/exams/:id/candidates', staff, async (request) => {
    const exam = await loadManagedExam(request.user!, request.params.id);
    return buildCandidateList(exam.id);
  });

  app.put<{ Params: { id: string }; Body: unknown }>('/api/v1/exams/:id/candidates', staff, async (request) => {
    const exam = await loadManagedExam(request.user!, request.params.id);
    const userIds = parseIdList(requireBodyObject(request.body).userIds, 'userIds', { allowEmpty: true });

    const enrolledCount = await prisma.enrollment.count({
      where: { courseId: exam.courseId, userId: { in: userIds } },
    });
    if (enrolledCount !== userIds.length) {
      throw validation('Seçilen öğrencilerin tümü sınavın kursuna kayıtlı olmalıdır.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.examCandidate.deleteMany({ where: { examId: exam.id } });
      if (userIds.length > 0) {
        await tx.examCandidate.createMany({ data: userIds.map((userId) => ({ examId: exam.id, userId })) });
      }
      await assertPublishedStillValid(tx, exam.id);
    });
    return buildCandidateList(exam.id);
  });
}

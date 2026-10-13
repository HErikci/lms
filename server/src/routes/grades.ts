import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/rbac.js';
import { AppError } from '../errors.js';
import { assertCanManageCourse } from '../lib/courseAccess.js';
import { buildRoster, computeGradeSummary, isValidScore, sortNewestFirst } from '../lib/grades.js';

type AuthUser = Parameters<typeof assertCanManageCourse>[0];

/**
 * Notlandırılabilir quiz dersini yükler: ders yoksa 404, çağıran kursu yönetemiyorsa 403,
 * ders QUIZ değilse 400 NOT_A_QUIZ. Yöneticiler taslak dersleri de görür (yayın filtresi yok).
 */
async function loadGradableQuiz(user: AuthUser, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, title: true, contentType: true, module: { select: { courseId: true } } },
  });
  if (!lesson) {
    throw new AppError('NOT_FOUND', 'Ders bulunamadı.', 404);
  }
  const courseId = lesson.module.courseId;
  await assertCanManageCourse(user, courseId);
  if (lesson.contentType !== 'QUIZ') {
    throw new AppError('NOT_A_QUIZ', 'Bu ders bir quiz değil.', 400);
  }
  return { id: lesson.id, title: lesson.title, courseId };
}

export function registerGradeRoutes(app: FastifyInstance) {
  // Kursa kayıtlı tüm öğrencilerin bu quizdeki notları (notu olmayanlar için null).
  app.get<{ Params: { lessonId: string } }>(
    '/api/v1/lessons/:lessonId/grades',
    { preHandler: [requireAuth] },
    async (request) => {
      const lesson = await loadGradableQuiz(request.user, request.params.lessonId);
      const [enrollments, grades] = await Promise.all([
        prisma.enrollment.findMany({
          where: { courseId: lesson.courseId },
          select: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        }),
        prisma.quizGrade.findMany({
          where: { lessonId: lesson.id },
          select: { userId: true, score: true, gradedAt: true },
        }),
      ]);
      return {
        lesson: { id: lesson.id, title: lesson.title, courseId: lesson.courseId },
        grades: buildRoster(
          enrollments.map((enrollment) => enrollment.user),
          grades,
        ),
      };
    },
  );

  // Not gir / güncelle (yeniden notlandırma). gradedAt ve gradedById her yazmada yenilenir.
  app.put<{ Params: { lessonId: string; userId: string }; Body: unknown }>(
    '/api/v1/lessons/:lessonId/grades/:userId',
    { preHandler: [requireAuth] },
    async (request) => {
      const { userId } = request.params;
      const lesson = await loadGradableQuiz(request.user, request.params.lessonId);

      const body = request.body;
      const score = typeof body === 'object' && body !== null ? (body as { score?: unknown }).score : undefined;
      if (!isValidScore(score)) {
        throw new AppError('VALIDATION_ERROR', 'score 0 ile 100 arasında bir tam sayı olmalıdır.', 400);
      }

      // Bilinmeyen kullanıcı ile kayıtsız öğrenci aynı yanıtı alır; kullanıcı varlığı sızdırılmaz.
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: lesson.courseId } },
        select: { id: true },
      });
      if (!enrollment) {
        throw new AppError('STUDENT_NOT_ENROLLED', 'Öğrenci bu kursa kayıtlı değil.', 400);
      }

      const where = { userId_lessonId: { userId, lessonId: lesson.id } };
      const data = { score, gradedById: request.user!.userId, gradedAt: new Date() };
      let grade;
      try {
        grade = await prisma.quizGrade.upsert({
          where,
          create: { userId, lessonId: lesson.id, ...data },
          update: data,
        });
      } catch (err) {
        // Aynı satırı ilk kez oluşturan eşzamanlı iki istekten kaybeden güncellemeye düşer.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          grade = await prisma.quizGrade.update({ where, data });
        } else {
          throw err;
        }
      }

      return {
        grade: {
          userId: grade.userId,
          lessonId: grade.lessonId,
          score: grade.score,
          gradedAt: grade.gradedAt.toISOString(),
        },
      };
    },
  );

  // Notu sil; idempotent. Kayıt kontrolü yapılmaz: kayıttan çıkarılmış öğrencinin artık
  // listede görünmeyen notu da silinebilir.
  app.delete<{ Params: { lessonId: string; userId: string } }>(
    '/api/v1/lessons/:lessonId/grades/:userId',
    { preHandler: [requireAuth] },
    async (request) => {
      const lesson = await loadGradableQuiz(request.user, request.params.lessonId);
      const { count } = await prisma.quizGrade.deleteMany({
        where: { userId: request.params.userId, lessonId: lesson.id },
      });
      return { deleted: count > 0 };
    },
  );

  // Kullanıcının kendi notları ve özeti.
  app.get('/api/v1/users/me/grades', { preHandler: [requireAuth] }, async (request) => {
    const rows = await prisma.quizGrade.findMany({
      where: { userId: request.user!.userId },
      select: {
        lessonId: true,
        score: true,
        gradedAt: true,
        lesson: {
          select: {
            title: true,
            module: { select: { course: { select: { id: true, title: true } } } },
          },
        },
      },
    });

    const entries = sortNewestFirst(
      rows.map((row) => ({
        lessonId: row.lessonId,
        lessonTitle: row.lesson.title,
        courseId: row.lesson.module.course.id,
        courseTitle: row.lesson.module.course.title,
        score: row.score,
        gradedAt: row.gradedAt,
      })),
    );

    return {
      summary: computeGradeSummary(entries.map((entry) => entry.score)),
      grades: entries.map((entry) => ({ ...entry, gradedAt: entry.gradedAt.toISOString() })),
    };
  });
}

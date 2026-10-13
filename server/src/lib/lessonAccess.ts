import { prisma } from './prisma.js';
import { AppError } from '../errors.js';

/** Kullanıcı kursa kayıtlı değilse 403 NOT_ENROLLED fırlatır. */
export async function assertEnrolled(userId: string, courseId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment) {
    throw new AppError('NOT_ENROLLED', 'Bu kursa kayıtlı değilsiniz.', 403);
  }
}

/** Yayınlanmış dersi modülüyle getirir; yoksa veya taslaksa 404 (taslağın varlığı sızdırılmaz). */
export async function loadPublishedLesson(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: true },
  });
  if (!lesson || lesson.status !== 'PUBLISHED') {
    throw new AppError('NOT_FOUND', 'Ders bulunamadı.', 404);
  }
  return lesson;
}

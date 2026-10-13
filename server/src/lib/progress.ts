import { prisma } from './prisma.js';

export interface CourseProgress {
  courseId: string;
  percent: number;
  completedLessonIds: string[];
  completedCount: number;
  totalLessons: number;
}

export function toPercent(completed: number, total: number): number {
  return total === 0 ? 0 : Math.round((100 * completed) / total);
}

export async function computeProgress(userId: string, courseId: string): Promise<CourseProgress> {
  const lessons = await prisma.lesson.findMany({
    where: { status: 'PUBLISHED', module: { courseId } },
    select: { id: true },
  });
  const lessonIds = lessons.map((lesson) => lesson.id);
  const records =
    lessonIds.length === 0
      ? []
      : await prisma.lessonProgress.findMany({
          where: { userId, lessonId: { in: lessonIds } },
          select: { lessonId: true },
          orderBy: { completedAt: 'asc' },
        });
  const completedLessonIds = records.map((record) => record.lessonId);
  return {
    courseId,
    percent: toPercent(completedLessonIds.length, lessonIds.length),
    completedLessonIds,
    completedCount: completedLessonIds.length,
    totalLessons: lessonIds.length,
  };
}

import { AppError } from '../errors.js';
import { prisma } from './prisma.js';
import { parseRoles } from './users.js';
import { computeProgress } from './progress.js';
import { addDays, dayKey } from './activity.js';

export function parseBirthDate(value: unknown): Date | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError('VALIDATION_ERROR', 'Doğum tarihi YYYY-MM-DD biçiminde olmalıdır.', 400);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value > dayKey(new Date()) || value < '1900-01-01') {
    throw new AppError('VALIDATION_ERROR', 'Geçerli, gelecekte olmayan bir doğum tarihi girin.', 400);
  }
  return parsed;
}

/** Age is evaluated by calendar date in the application's activity timezone. */
export function isMinor(birthDate: Date | null | undefined, now = new Date()): boolean {
  if (!birthDate || !Number.isFinite(birthDate.getTime())) return false;
  const today = dayKey(now);
  const birth = birthDate.toISOString().slice(0, 10);
  const eighteenthBirthday = `${Number(birth.slice(0, 4)) + 18}${birth.slice(4)}`;
  return birth <= today && today < eighteenthBirthday;
}

export const guardianLinkInclude = {
  student: { select: { id: true, name: true, email: true, birthDate: true, role: true, roles: true, disabledAt: true } },
  guardian: { select: { id: true, name: true, email: true, role: true, roles: true, disabledAt: true } },
} as const;

type LinkedUser = { role: string; roles: string; disabledAt: Date | null };
export function linkIsAccessible(link: { student: LinkedUser & { birthDate: Date | null }; guardian: LinkedUser }): boolean {
  return !link.student.disabledAt && !link.guardian.disabledAt && isMinor(link.student.birthDate)
    && parseRoles(link.student).includes('STUDENT') && parseRoles(link.guardian).includes('GUARDIAN');
}

export async function requireGuardianLink(studentId: string, guardianId: string) {
  const link = await prisma.guardianLink.findUnique({
    where: { studentId_guardianId: { studentId, guardianId } }, include: guardianLinkInclude,
  });
  if (!link || !linkIsAccessible(link)) {
    throw new AppError('NOT_FOUND', 'Öğrenci bulunamadı veya veli erişiminiz yok.', 404);
  }
  return link;
}

export interface GuardianReport {
  student: { id: string; name: string; birthDate: string | null };
  courses: { id: string; title: string; progress: { percent: number; completedCount: number; totalLessons: number } }[];
  grades: { lessonTitle: string; courseTitle: string; score: number; gradedAt: string }[];
  exams: { title: string; courseTitle: string; score: number | null; status: string; submittedAt: string | null }[];
  studySeconds: number;
  generatedAt: string;
}

export async function buildGuardianReport(studentId: string): Promise<GuardianReport> {
  const student = await prisma.user.findUniqueOrThrow({ where: { id: studentId }, select: { id: true, name: true, birthDate: true } });
  const now = new Date();
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: studentId, course: { status: 'PUBLISHED' } },
    select: { course: { select: { id: true, title: true } } }, orderBy: { enrolledAt: 'desc' },
  });
  const courseIds = enrollments.map(({ course }) => course.id);
  const [courses, grades, attempts, activity] = await Promise.all([
    Promise.all(enrollments.map(async ({ course }) => {
      const progress = await computeProgress(studentId, course.id);
      return { ...course, progress: { percent: progress.percent, completedCount: progress.completedCount, totalLessons: progress.totalLessons } };
    })),
    prisma.quizGrade.findMany({
      where: { userId: studentId, lesson: { status: 'PUBLISHED', module: { courseId: { in: courseIds } } } },
      include: { lesson: { include: { module: { include: { course: { select: { title: true } } } } } } },
      orderBy: { gradedAt: 'desc' }, take: 100,
    }),
    prisma.examAttempt.findMany({
      where: { userId: studentId, exam: { status: 'PUBLISHED', courseId: { in: courseIds } } },
      include: { exam: { select: { title: true, showResults: true, course: { select: { title: true } } } } },
      orderBy: { startedAt: 'desc' }, take: 100,
    }),
    prisma.studyActivity.aggregate({ where: { userId: studentId, courseId: { in: courseIds }, day: { gte: addDays(dayKey(now), -6), lte: dayKey(now) } }, _sum: { seconds: true } }),
  ]);
  return {
    student: { ...student, birthDate: student.birthDate?.toISOString().slice(0, 10) ?? null }, courses,
    grades: grades.map((grade) => ({ lessonTitle: grade.lesson.title, courseTitle: grade.lesson.module.course.title, score: grade.score, gradedAt: grade.gradedAt.toISOString() })),
    exams: attempts.map((attempt) => {
      // Respect both the immutable attempt setting and any later result restriction.
      const snapshot = JSON.parse(attempt.snapshot) as { showResults?: boolean };
      const result = attempt.result ? JSON.parse(attempt.result) as { score?: number } : null;
      return { title: attempt.exam.title, courseTitle: attempt.exam.course.title,
        score: attempt.status === 'SUBMITTED' && snapshot.showResults === true && attempt.exam.showResults && typeof result?.score === 'number' ? result.score : null,
        status: attempt.status, submittedAt: attempt.submittedAt?.toISOString() ?? null };
    }),
    studySeconds: activity._sum.seconds ?? 0, generatedAt: now.toISOString(),
  };
}

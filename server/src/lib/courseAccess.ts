import { prisma } from './prisma.js';
import { AppError } from '../errors.js';
import type { TokenPayload } from './jwt.js';

type AccessUser = Pick<TokenPayload, 'userId' | 'role'> | undefined;

/**
 * ADMIN her kursu yönetebilir; INSTRUCTOR (aktif rol) yalnızca kendisine atanmış kursları yönetebilir.
 */
export async function canManageCourse(user: AccessUser, courseId: string): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'INSTRUCTOR') return false;
  const assignment = await prisma.courseInstructor.findUnique({
    where: { courseId_userId: { courseId, userId: user.userId } },
    select: { id: true },
  });
  return Boolean(assignment);
}

/** Eğitmenin (yalnızca aktif rol INSTRUCTOR iken) atandığı kurs kimlikleri; diğer roller için boş küme. */
export async function assignedCourseIds(user: AccessUser): Promise<Set<string>> {
  if (!user || user.role !== 'INSTRUCTOR') return new Set();
  const rows = await prisma.courseInstructor.findMany({
    where: { userId: user.userId },
    select: { courseId: true },
  });
  return new Set(rows.map((row) => row.courseId));
}

export async function assertCanManageCourse(
  user: AccessUser,
  courseId: string,
  message = 'Bu işlem için yetkiniz yok.',
): Promise<void> {
  if (!(await canManageCourse(user, courseId))) {
    throw new AppError('FORBIDDEN', message, 403);
  }
}

export interface InstructorRow {
  position: number;
  user: { id: string; name: string; avatarUrl: string | null };
}

export function toPublicInstructors(rows: InstructorRow[]) {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      id: row.user.id,
      name: row.user.name,
      avatarUrl: row.user.avatarUrl,
      position: row.position,
    }));
}

/** Prisma include fragment: sıralı, e-postasız eğitmen listesi. */
export const instructorsInclude = {
  orderBy: { position: 'asc' },
  select: {
    position: true,
    user: { select: { id: true, name: true, avatarUrl: true } },
  },
} as const;

export function hasInstructorRole(roles: string): boolean {
  return roles
    .split(',')
    .map((r) => r.trim())
    .includes('INSTRUCTOR');
}

import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole, tryAuth } from '../middleware/rbac.js';
import { AppError } from '../errors.js';
import {
  canManageCourse,
  hasInstructorRole,
  instructorsInclude,
  toPublicInstructors,
} from '../lib/courseAccess.js';

type Tx = Prisma.TransactionClient;

/**
 * Kullanıcı kimliklerini doğrular: hepsi mevcut ve INSTRUCTOR rolüne sahip olmalı.
 * `missingStatus`: bilinmeyen kullanıcı için HTTP durumu (POST /instructors -> 404, POST /courses -> 400).
 */
export async function resolveInstructorUsers(userIds: string[], missingStatus: number) {
  if (userIds.length === 0) return [];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const byId = new Map(users.map((user) => [user.id, user]));
  for (const id of userIds) {
    const user = byId.get(id);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'Kullanıcı bulunamadı.', missingStatus);
    }
    if (!hasInstructorRole(user.roles)) {
      throw new AppError('USER_NOT_INSTRUCTOR', 'Kullanıcı eğitmen rolüne sahip değil.', 400);
    }
  }
  return users;
}

async function listInstructors(db: Tx | typeof prisma, courseId: string) {
  const rows = await db.courseInstructor.findMany({
    where: { courseId },
    ...instructorsInclude,
  });
  return toPublicInstructors(rows);
}

/** Konumları 1..N olarak yeniden yazar (yalnızca değişenler güncellenir). */
async function applyOrder(tx: Tx, courseId: string, orderedUserIds: string[]) {
  const rows = await tx.courseInstructor.findMany({ where: { courseId } });
  const byUser = new Map(rows.map((row) => [row.userId, row]));
  for (const [index, userId] of orderedUserIds.entries()) {
    const row = byUser.get(userId);
    if (row && row.position !== index + 1) {
      await tx.courseInstructor.update({ where: { id: row.id }, data: { position: index + 1 } });
    }
  }
}

async function currentOrder(tx: Tx, courseId: string): Promise<string[]> {
  const rows = await tx.courseInstructor.findMany({
    where: { courseId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map((row) => row.userId);
}

async function requireCourse(courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
  }
  return course;
}

export function registerCourseInstructorRoutes(app: FastifyInstance) {
  app.get<{ Params: { courseId: string } }>(
    '/api/v1/courses/:courseId/instructors',
    { preHandler: [tryAuth] },
    async (request) => {
      const course = await requireCourse(request.params.courseId);
      if (course.status !== 'PUBLISHED' && !(await canManageCourse(request.user, course.id))) {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      return { instructors: await listInstructors(prisma, course.id) };
    },
  );

  app.post<{ Params: { courseId: string }; Body: { userId?: string; position?: number } }>(
    '/api/v1/courses/:courseId/instructors',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request, reply) => {
      const course = await requireCourse(request.params.courseId);
      const { userId, position } = request.body ?? {};
      if (typeof userId !== 'string' || userId === '') {
        throw new AppError('VALIDATION_ERROR', 'userId zorunludur.', 400);
      }
      if (position !== undefined && (typeof position !== 'number' || !Number.isFinite(position))) {
        throw new AppError('VALIDATION_ERROR', 'Geçersiz sıra değeri.', 400);
      }
      await resolveInstructorUsers([userId], 404);
      const alreadyAssigned = () =>
        new AppError('INSTRUCTOR_ALREADY_ASSIGNED', 'Eğitmen bu kursa zaten atanmış.', 409);
      try {
        await prisma.$transaction(async (tx) => {
          const order = await currentOrder(tx, course.id);
          if (order.includes(userId)) throw alreadyAssigned();
          const target = Math.min(
            Math.max(Math.trunc(position ?? order.length + 1), 1),
            order.length + 1,
          );
          // Geçici olarak sona ekle, sonra yoğun sıralamayı uygula.
          await tx.courseInstructor.create({
            data: { courseId: course.id, userId, position: order.length + 1 },
          });
          order.splice(target - 1, 0, userId);
          await applyOrder(tx, course.id, order);
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw alreadyAssigned();
        }
        throw error;
      }
      reply.status(201);
      return { instructors: await listInstructors(prisma, course.id) };
    },
  );

  app.put<{ Params: { courseId: string }; Body: { userIds?: string[] } }>(
    '/api/v1/courses/:courseId/instructors/order',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request) => {
      const course = await requireCourse(request.params.courseId);
      const userIds = request.body?.userIds;
      const invalid = () =>
        new AppError('INVALID_INSTRUCTOR_ORDER', 'Eğitmen sırası mevcut atamalarla eşleşmiyor.', 400);
      if (!Array.isArray(userIds) || userIds.some((id) => typeof id !== 'string')) {
        throw invalid();
      }
      await prisma.$transaction(async (tx) => {
        const current = await currentOrder(tx, course.id);
        const unique = new Set(userIds);
        if (
          unique.size !== userIds.length ||
          userIds.length !== current.length ||
          !current.every((id) => unique.has(id))
        ) {
          throw invalid();
        }
        await applyOrder(tx, course.id, userIds);
      });
      return { instructors: await listInstructors(prisma, course.id) };
    },
  );

  app.delete<{ Params: { courseId: string; userId: string } }>(
    '/api/v1/courses/:courseId/instructors/:userId',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request) => {
      const course = await requireCourse(request.params.courseId);
      await prisma.$transaction(async (tx) => {
        const order = await currentOrder(tx, course.id);
        if (!order.includes(request.params.userId)) {
          throw new AppError('INSTRUCTOR_NOT_ASSIGNED', 'Eğitmen bu kursa atanmamış.', 404);
        }
        await tx.courseInstructor.delete({
          where: { courseId_userId: { courseId: course.id, userId: request.params.userId } },
        });
        await applyOrder(
          tx,
          course.id,
          order.filter((id) => id !== request.params.userId),
        );
      });
      return { instructors: await listInstructors(prisma, course.id) };
    },
  );

  app.get<{ Querystring: { q?: string } }>(
    '/api/v1/instructors',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request) => {
      const q = request.query.q?.trim();
      const users = await prisma.user.findMany({
        where: {
          roles: { contains: 'INSTRUCTOR' },
          ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
        },
        orderBy: { name: 'asc' },
      });
      return {
        instructors: users
          .filter((user) => hasInstructorRole(user.roles))
          .map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
          })),
      };
    },
  );
}

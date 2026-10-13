import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { AppError } from '../errors.js';

interface EnrollBody {
  method: 'OPEN' | 'INVITE_CODE' | 'ADMIN_ASSIGNED';
}

export function registerEnrollmentRoutes(app: FastifyInstance) {
  app.post<{ Params: { courseId: string }; Body: EnrollBody }>(
    '/api/v1/courses/:courseId/enroll',
    { preHandler: [requireAuth, requireRole('STUDENT')] },
    async (request, reply) => {
      const course = await prisma.course.findUnique({ where: { id: request.params.courseId } });
      if (!course) {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      const existing = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: request.user!.userId, courseId: course.id } },
      });
      if (existing) {
        throw new AppError('ALREADY_ENROLLED', 'Bu kursa zaten kayıtlısınız.', 409);
      }
      const enrollment = await prisma.enrollment.create({
        data: { userId: request.user!.userId, courseId: course.id, method: request.body.method },
      });
      reply.status(201);
      return {
        enrollment: {
          id: enrollment.id,
          userId: enrollment.userId,
          courseId: enrollment.courseId,
          method: enrollment.method,
          enrolledAt: enrollment.enrolledAt,
        },
      };
    },
  );

  app.get(
    '/api/v1/users/me/courses',
    { preHandler: [requireAuth] },
    async (request) => {
      const enrollments = await prisma.enrollment.findMany({
        where: { userId: request.user!.userId },
        include: { course: true },
      });
      return {
        courses: enrollments.map(({ course }) => ({
          id: course.id,
          title: course.title,
          category: course.category,
          level: course.level,
          accessMode: course.accessMode,
        })),
      };
    },
  );
}

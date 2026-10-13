import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { AppError } from '../errors.js';

interface CreateModuleBody {
  title: string;
  order: number;
}

export function registerModuleRoutes(app: FastifyInstance) {
  app.post<{ Params: { courseId: string }; Body: CreateModuleBody }>(
    '/api/v1/courses/:courseId/modules',
    { preHandler: [requireAuth, requireRole('INSTRUCTOR', 'ADMIN')] },
    async (request, reply) => {
      const course = await prisma.course.findUnique({ where: { id: request.params.courseId } });
      if (!course) {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      if (request.user!.role !== 'ADMIN' && course.instructorId !== request.user!.userId) {
        throw new AppError('FORBIDDEN', 'Bu kursu düzenleme yetkiniz yok.', 403);
      }
      const module = await prisma.module.create({
        data: {
          courseId: course.id,
          title: request.body.title,
          order: request.body.order,
        },
      });
      reply.status(201);
      return { module: { id: module.id, courseId: module.courseId, title: module.title, order: module.order } };
    },
  );
}

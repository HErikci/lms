import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { AppError } from '../errors.js';

interface CreateLessonBody {
  title: string;
  order: number;
  status: 'DRAFT' | 'PUBLISHED';
}

export function registerLessonRoutes(app: FastifyInstance) {
  app.post<{ Params: { moduleId: string }; Body: CreateLessonBody }>(
    '/api/v1/modules/:moduleId/lessons',
    { preHandler: [requireAuth, requireRole('INSTRUCTOR', 'ADMIN')] },
    async (request, reply) => {
      const module = await prisma.module.findUnique({
        where: { id: request.params.moduleId },
        include: { course: true },
      });
      if (!module) {
        throw new AppError('NOT_FOUND', 'Modül bulunamadı.', 404);
      }
      if (request.user!.role !== 'ADMIN' && module.course.instructorId !== request.user!.userId) {
        throw new AppError('FORBIDDEN', 'Bu kursu düzenleme yetkiniz yok.', 403);
      }
      const lesson = await prisma.lesson.create({
        data: {
          moduleId: module.id,
          title: request.body.title,
          order: request.body.order,
          status: request.body.status,
        },
      });
      reply.status(201);
      return {
        lesson: { id: lesson.id, moduleId: lesson.moduleId, title: lesson.title, order: lesson.order, status: lesson.status },
      };
    },
  );
}

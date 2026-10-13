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
      const module = await prisma.module.findUnique({ where: { id: request.params.moduleId } });
      if (!module) {
        throw new AppError('NOT_FOUND', 'Modül bulunamadı.', 404);
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

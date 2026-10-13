import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { AppError } from '../errors.js';

interface CreateModuleBody {
  title: string;
  order: number;
}

interface UpdateModuleBody {
  title?: string;
  order?: number;
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

  app.patch<{ Params: { id: string }; Body: UpdateModuleBody }>(
    '/api/v1/modules/:id',
    { preHandler: [requireAuth, requireRole('INSTRUCTOR', 'ADMIN')] },
    async (request) => {
      const module = await prisma.module.findUnique({
        where: { id: request.params.id },
        include: { course: true },
      });
      if (!module) {
        throw new AppError('NOT_FOUND', 'Modül bulunamadı.', 404);
      }
      if (request.user!.role !== 'ADMIN' && module.course.instructorId !== request.user!.userId) {
        throw new AppError('FORBIDDEN', 'Bu kursu düzenleme yetkiniz yok.', 403);
      }
      const { title, order } = request.body;
      const updated = await prisma.module.update({
        where: { id: module.id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(order !== undefined ? { order } : {}),
        },
      });
      return { module: { id: updated.id, courseId: updated.courseId, title: updated.title, order: updated.order } };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/modules/:id',
    { preHandler: [requireAuth, requireRole('INSTRUCTOR', 'ADMIN')] },
    async (request) => {
      const module = await prisma.module.findUnique({
        where: { id: request.params.id },
        include: { course: true },
      });
      if (!module) {
        throw new AppError('NOT_FOUND', 'Modül bulunamadı.', 404);
      }
      if (request.user!.role !== 'ADMIN' && module.course.instructorId !== request.user!.userId) {
        throw new AppError('FORBIDDEN', 'Bu kursu düzenleme yetkiniz yok.', 403);
      }
      await prisma.module.delete({ where: { id: module.id } });
      return { success: true };
    },
  );
}

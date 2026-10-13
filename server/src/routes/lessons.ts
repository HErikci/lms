import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { AppError } from '../errors.js';

const ALLOWED_CONTENT_TYPES = ['VIDEO_YOUTUBE', 'DOCUMENT', 'QUIZ', 'LINK', 'TEXT'] as const;
type ContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

function assertValidContentType(contentType: string | undefined): void {
  if (contentType !== undefined && !ALLOWED_CONTENT_TYPES.includes(contentType as ContentType)) {
    throw new AppError('INVALID_CONTENT_TYPE', 'Geçersiz içerik türü.', 400);
  }
}

function toPublicLesson(lesson: {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  contentType: string;
  contentUrl: string | null;
  order: number;
  status: string;
}) {
  return {
    id: lesson.id,
    moduleId: lesson.moduleId,
    title: lesson.title,
    description: lesson.description,
    contentType: lesson.contentType,
    contentUrl: lesson.contentUrl,
    order: lesson.order,
    status: lesson.status,
  };
}

interface CreateLessonBody {
  title: string;
  order: number;
  status: 'DRAFT' | 'PUBLISHED';
  description?: string | null;
  contentType?: string;
  contentUrl?: string | null;
}

interface UpdateLessonBody {
  title?: string;
  order?: number;
  status?: 'DRAFT' | 'PUBLISHED';
  description?: string | null;
  contentType?: string;
  contentUrl?: string | null;
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
      assertValidContentType(request.body.contentType);
      const lesson = await prisma.lesson.create({
        data: {
          moduleId: module.id,
          title: request.body.title,
          order: request.body.order,
          status: request.body.status,
          description: request.body.description ?? null,
          ...(request.body.contentType !== undefined ? { contentType: request.body.contentType } : {}),
          contentUrl: request.body.contentUrl ?? null,
        },
      });
      reply.status(201);
      return { lesson: toPublicLesson(lesson) };
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateLessonBody }>(
    '/api/v1/lessons/:id',
    { preHandler: [requireAuth, requireRole('INSTRUCTOR', 'ADMIN')] },
    async (request) => {
      const lesson = await prisma.lesson.findUnique({
        where: { id: request.params.id },
        include: { module: { include: { course: true } } },
      });
      if (!lesson) {
        throw new AppError('NOT_FOUND', 'Ders bulunamadı.', 404);
      }
      if (
        request.user!.role !== 'ADMIN' &&
        lesson.module.course.instructorId !== request.user!.userId
      ) {
        throw new AppError('FORBIDDEN', 'Bu kursu düzenleme yetkiniz yok.', 403);
      }
      const { title, order, status, description, contentType, contentUrl } = request.body;
      assertValidContentType(contentType);
      const updated = await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(order !== undefined ? { order } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(contentType !== undefined ? { contentType } : {}),
          ...(contentUrl !== undefined ? { contentUrl } : {}),
        },
      });
      return { lesson: toPublicLesson(updated) };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/lessons/:id',
    { preHandler: [requireAuth, requireRole('INSTRUCTOR', 'ADMIN')] },
    async (request) => {
      const lesson = await prisma.lesson.findUnique({
        where: { id: request.params.id },
        include: { module: { include: { course: true } } },
      });
      if (!lesson) {
        throw new AppError('NOT_FOUND', 'Ders bulunamadı.', 404);
      }
      if (
        request.user!.role !== 'ADMIN' &&
        lesson.module.course.instructorId !== request.user!.userId
      ) {
        throw new AppError('FORBIDDEN', 'Bu kursu düzenleme yetkiniz yok.', 403);
      }
      await prisma.lesson.delete({ where: { id: lesson.id } });
      return { success: true };
    },
  );
}

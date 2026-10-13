import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole, tryAuth } from '../middleware/rbac.js';
import { AppError } from '../errors.js';

interface CreateCourseBody {
  title: string;
  description: string;
  category: string;
  level: string;
  tags: string[];
  accessMode: 'SEQUENTIAL' | 'FREE';
}

interface ListCoursesQuery {
  category?: string;
  level?: string;
  tag?: string;
  q?: string;
}

function toPublicCourse(course: {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  tags: string;
  accessMode: string;
  status: string;
}) {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    category: course.category,
    level: course.level,
    tags: course.tags ? course.tags.split(',') : [],
    accessMode: course.accessMode,
    status: course.status,
  };
}

interface UpdateCourseBody {
  title?: string;
  description?: string;
  category?: string;
  level?: string;
  tags?: string[];
  accessMode?: 'SEQUENTIAL' | 'FREE';
  status?: 'DRAFT' | 'PUBLISHED';
}

export function registerCourseRoutes(app: FastifyInstance) {
  app.get<{ Querystring: ListCoursesQuery }>(
    '/api/v1/courses',
    { preHandler: [tryAuth] },
    async (request) => {
      const { category, level, tag, q } = request.query;
      const isAdmin = request.user?.role === 'ADMIN';
      const courses = await prisma.course.findMany({
        where: {
          ...(isAdmin ? {} : { status: 'PUBLISHED' }),
          ...(category ? { category } : {}),
          ...(level ? { level } : {}),
          ...(tag ? { tags: { contains: tag } } : {}),
          ...(q ? { title: { contains: q } } : {}),
        },
      });
      return { courses: courses.map(toPublicCourse) };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/courses/:id',
    { preHandler: [tryAuth] },
    async (request) => {
      const course = await prisma.course.findUnique({
        where: { id: request.params.id },
        include: { modules: { include: { lessons: true }, orderBy: { order: 'asc' } } },
      });
      if (!course) {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      const isOwnerOrAdmin =
        request.user?.role === 'ADMIN' || request.user?.userId === course.instructorId;
      if (course.status !== 'PUBLISHED' && !isOwnerOrAdmin) {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      let isEnrolled = false;
      if (!isOwnerOrAdmin && request.user) {
        const enrollment = await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: request.user.userId, courseId: course.id } },
        });
        isEnrolled = Boolean(enrollment);
      }
      const canSeeContent = isOwnerOrAdmin || isEnrolled;
      return {
        course: {
          ...toPublicCourse(course),
          isEnrolled,
          modules: canSeeContent
            ? course.modules.map((module) => ({
                id: module.id,
                title: module.title,
                order: module.order,
                lessons: module.lessons
                  .filter((lesson) => isOwnerOrAdmin || lesson.status === 'PUBLISHED')
                  .sort((a, b) => a.order - b.order)
                  .map((lesson) => ({
                    id: lesson.id,
                    title: lesson.title,
                    description: lesson.description,
                    contentType: lesson.contentType,
                    contentUrl: lesson.contentUrl,
                    order: lesson.order,
                    status: lesson.status,
                  })),
              }))
            : [],
        },
      };
    },
  );

  app.post<{ Body: CreateCourseBody }>(
    '/api/v1/courses',
    { preHandler: [requireAuth, requireRole('INSTRUCTOR', 'ADMIN')] },
    async (request, reply) => {
      const { title, description, category, level, tags, accessMode } = request.body;
      const course = await prisma.course.create({
        data: {
          title,
          description,
          category,
          level,
          tags: tags.join(','),
          accessMode,
          instructorId: request.user!.userId,
        },
      });
      reply.status(201);
      return { course: toPublicCourse(course) };
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateCourseBody }>(
    '/api/v1/courses/:id',
    { preHandler: [requireAuth] },
    async (request) => {
      const course = await prisma.course.findUnique({ where: { id: request.params.id } });
      if (!course) {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      const isOwnerOrAdmin =
        request.user!.role === 'ADMIN' ||
        (request.user!.role === 'INSTRUCTOR' && request.user!.userId === course.instructorId);
      if (!isOwnerOrAdmin) {
        throw new AppError('FORBIDDEN', 'Bu işlem için yetkiniz yok.', 403);
      }
      const { title, description, category, level, tags, accessMode, status } = request.body;
      const updated = await prisma.course.update({
        where: { id: course.id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(category !== undefined ? { category } : {}),
          ...(level !== undefined ? { level } : {}),
          ...(tags !== undefined ? { tags: tags.join(',') } : {}),
          ...(accessMode !== undefined ? { accessMode } : {}),
          ...(status !== undefined ? { status } : {}),
        },
      });
      return { course: toPublicCourse(updated) };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/courses/:id',
    { preHandler: [requireAuth] },
    async (request) => {
      const course = await prisma.course.findUnique({ where: { id: request.params.id } });
      if (!course) {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      const isOwnerOrAdmin =
        request.user!.role === 'ADMIN' ||
        (request.user!.role === 'INSTRUCTOR' && request.user!.userId === course.instructorId);
      if (!isOwnerOrAdmin) {
        throw new AppError('FORBIDDEN', 'Bu işlem için yetkiniz yok.', 403);
      }
      await prisma.course.delete({ where: { id: course.id } });
      return { success: true };
    },
  );

  app.get<{ Params: { courseId: string } }>(
    '/api/v1/courses/:courseId/students',
    { preHandler: [requireAuth] },
    async (request) => {
      const course = await prisma.course.findUnique({ where: { id: request.params.courseId } });
      if (!course) {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      const isOwnerOrAdmin =
        request.user!.role === 'ADMIN' ||
        (request.user!.role === 'INSTRUCTOR' && request.user!.userId === course.instructorId);
      if (!isOwnerOrAdmin) {
        throw new AppError('FORBIDDEN', 'Bu işlem için yetkiniz yok.', 403);
      }
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId: course.id },
        include: { user: true },
        orderBy: { enrolledAt: 'asc' },
      });
      return {
        students: enrollments.map((enrollment) => ({
          id: enrollment.user.id,
          name: enrollment.user.name,
          email: enrollment.user.email,
          enrolledAt: enrollment.enrolledAt,
          method: enrollment.method,
        })),
      };
    },
  );

  app.delete<{ Params: { courseId: string; userId: string } }>(
    '/api/v1/courses/:courseId/students/:userId',
    { preHandler: [requireAuth] },
    async (request) => {
      const course = await prisma.course.findUnique({ where: { id: request.params.courseId } });
      if (!course) {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      const isOwnerOrAdmin =
        request.user!.role === 'ADMIN' ||
        (request.user!.role === 'INSTRUCTOR' && request.user!.userId === course.instructorId);
      if (!isOwnerOrAdmin) {
        throw new AppError('FORBIDDEN', 'Bu işlem için yetkiniz yok.', 403);
      }
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: request.params.userId, courseId: course.id } },
      });
      if (!enrollment) {
        throw new AppError('ENROLLMENT_NOT_FOUND', 'Kayıt bulunamadı.', 404);
      }
      await prisma.enrollment.delete({ where: { id: enrollment.id } });
      return { success: true };
    },
  );
}

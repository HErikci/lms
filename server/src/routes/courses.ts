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

export function registerCourseRoutes(app: FastifyInstance) {
  app.get<{ Querystring: ListCoursesQuery }>('/api/v1/courses', async (request) => {
    const { category, level, tag, q } = request.query;
    const courses = await prisma.course.findMany({
      where: {
        status: 'PUBLISHED',
        ...(category ? { category } : {}),
        ...(level ? { level } : {}),
        ...(tag ? { tags: { contains: tag } } : {}),
        ...(q ? { title: { contains: q } } : {}),
      },
    });
    return { courses: courses.map(toPublicCourse) };
  });

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
      return {
        course: {
          ...toPublicCourse(course),
          modules: course.modules.map((module) => ({
            id: module.id,
            title: module.title,
            order: module.order,
            lessons: module.lessons
              .filter((lesson) => isOwnerOrAdmin || lesson.status === 'PUBLISHED')
              .sort((a, b) => a.order - b.order)
              .map((lesson) => ({
                id: lesson.id,
                title: lesson.title,
                order: lesson.order,
                status: lesson.status,
              })),
          })),
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
}

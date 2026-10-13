import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/rbac.js';
import { AppError } from '../errors.js';
import { assertCanManageCourse } from '../lib/courseAccess.js';
import {
  canEditEvent,
  normalizeEventInput,
  parseRange,
  serializeEvent,
  toRawInput,
  type RawEventInput,
} from '../lib/calendar.js';

type AuthUser = NonNullable<Parameters<typeof assertCanManageCourse>[0]>;

const eventInclude = { course: { select: { id: true, title: true } } } as const;

/** Etkinlik oluşturma/düzenleme/silme yetkisi için hedef kurs (null = genel etkinlik). */
async function assertCanWriteTarget(user: AuthUser, courseId: string | null): Promise<void> {
  if (courseId === null) {
    if (user.role !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 'Genel etkinlikleri yalnızca yöneticiler yönetebilir.', 403);
    }
    return;
  }
  await assertCanManageCourse(user, courseId);
}

/** Eğitmenin (yalnızca aktif rol INSTRUCTOR iken) atandığı kurs kimlikleri. */
async function assignedCourseIds(user: AuthUser): Promise<Set<string>> {
  if (user.role !== 'INSTRUCTOR') return new Set();
  const rows = await prisma.courseInstructor.findMany({
    where: { userId: user.userId },
    select: { courseId: true },
  });
  return new Set(rows.map((row) => row.courseId));
}

async function assertCourseExists(courseId: string): Promise<void> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
}

function requireBodyObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError('VALIDATION_ERROR', 'İstek gövdesi bir nesne olmalıdır.', 400);
  }
  return body as Record<string, unknown>;
}

async function loadEvent(id: string) {
  const event = await prisma.calendarEvent.findUnique({ where: { id }, include: eventInclude });
  if (!event) throw new AppError('NOT_FOUND', 'Etkinlik bulunamadı.', 404);
  return event;
}

const PATCH_FIELDS = ['title', 'description', 'type', 'start', 'end', 'allDay', 'location', 'courseId'] as const;

export function registerCalendarRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { from?: string; to?: string } }>(
    '/api/v1/calendar/events',
    { preHandler: [requireAuth] },
    async (request) => {
      const user = request.user!;
      const { from, to } = parseRange(request.query.from, request.query.to);

      const [assigned, enrolledRows] = await Promise.all([
        assignedCourseIds(user),
        user.role === 'ADMIN'
          ? Promise.resolve([])
          : prisma.enrollment.findMany({ where: { userId: user.userId }, select: { courseId: true } }),
      ]);

      const overlap = {
        OR: [
          // Bitişi olmayan etkinlik bir an sayılır: [from, to) içinde olmalı.
          { end: null, start: { gte: from, lt: to } },
          { end: { gt: from }, start: { lt: to } },
        ],
      };
      const visibleCourseIds = [...new Set([...enrolledRows.map((row) => row.courseId), ...assigned])];
      const visibility =
        user.role === 'ADMIN' ? {} : { OR: [{ courseId: null }, { courseId: { in: visibleCourseIds } }] };

      const events = await prisma.calendarEvent.findMany({
        where: { AND: [overlap, visibility] },
        include: eventInclude,
        orderBy: [{ start: 'asc' }, { createdAt: 'asc' }],
      });

      return {
        events: events.map((event) => serializeEvent(event, canEditEvent(user, event.courseId, assigned))),
      };
    },
  );

  app.post<{ Body: unknown }>('/api/v1/calendar/events', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user!;
    const data = normalizeEventInput(requireBodyObject(request.body) as RawEventInput);
    if (data.courseId !== null) await assertCourseExists(data.courseId);
    await assertCanWriteTarget(user, data.courseId);

    const created = await prisma.calendarEvent.create({
      data: { ...data, createdById: user.userId },
      include: eventInclude,
    });
    reply.status(201);
    return { event: serializeEvent(created, true) };
  });

  app.patch<{ Params: { id: string }; Body: unknown }>(
    '/api/v1/calendar/events/:id',
    { preHandler: [requireAuth] },
    async (request) => {
      const user = request.user!;
      const existing = await loadEvent(request.params.id);
      await assertCanWriteTarget(user, existing.courseId);

      const body = requireBodyObject(request.body);
      if (!PATCH_FIELDS.some((field) => body[field] !== undefined)) {
        throw new AppError('VALIDATION_ERROR', 'Güncellenecek en az bir alan gönderilmelidir.', 400);
      }

      const merged: Record<string, unknown> = { ...toRawInput(existing) };
      for (const field of PATCH_FIELDS) {
        if (body[field] !== undefined) merged[field] = body[field];
      }

      // allDay değişirse mevcut start/end biçimi uyumsuz olur: yeni start zorunlu, end verilmezse varsayılana döner.
      if (typeof body.allDay === 'boolean' && body.allDay !== existing.allDay) {
        if (body.start === undefined) {
          throw new AppError(
            'VALIDATION_ERROR',
            'allDay değiştirilirken yeni biçime uygun start (ve isteğe bağlı end) gönderilmelidir.',
            400,
          );
        }
        if (body.end === undefined) merged.end = null;
      }

      const data = normalizeEventInput(merged as RawEventInput);
      if (data.courseId !== existing.courseId) {
        if (data.courseId !== null) await assertCourseExists(data.courseId);
        await assertCanWriteTarget(user, data.courseId);
      }

      const updated = await prisma.calendarEvent.update({
        where: { id: existing.id },
        data,
        include: eventInclude,
      });
      return { event: serializeEvent(updated, canEditEvent(user, updated.courseId, await assignedCourseIds(user))) };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/calendar/events/:id',
    { preHandler: [requireAuth] },
    async (request) => {
      const existing = await loadEvent(request.params.id);
      await assertCanWriteTarget(request.user!, existing.courseId);
      // deleteMany: eşzamanlı silmede P2025 yerine idempotent davranır.
      await prisma.calendarEvent.deleteMany({ where: { id: existing.id } });
      return { deleted: true };
    },
  );
}

import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { AppError } from '../errors.js';
import { assertCanManageCourse } from '../lib/courseAccess.js';
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_STATES,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  announcementState,
  canEditAnnouncement,
  liveWhere,
  normalizeAnnouncementInput,
  serializeAnnouncement,
  toRawInput,
  type AnnouncementState,
  type RawAnnouncementInput,
} from '../lib/announcements.js';

type AuthUser = NonNullable<Parameters<typeof assertCanManageCourse>[0]>;

const announcementInclude = {
  course: { select: { id: true, title: true } },
  author: { select: { id: true, name: true } },
} as const;

/** Duyuru oluşturma/düzenleme/silme yetkisi için hedef kurs (null = genel duyuru). */
async function assertCanWriteTarget(user: AuthUser, courseId: string | null): Promise<void> {
  if (courseId === null) {
    if (user.role !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 'Genel duyuruları yalnızca yöneticiler yönetebilir.', 403);
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

/** Okuyucunun görebileceği kurs kimlikleri (kayıtlı + aktif rol INSTRUCTOR iken atanmış). ADMIN için null = hepsi. */
async function readableCourseIds(user: AuthUser, assigned: Set<string>): Promise<string[] | null> {
  if (user.role === 'ADMIN') return null;
  const enrolled = await prisma.enrollment.findMany({ where: { userId: user.userId }, select: { courseId: true } });
  return [...new Set([...enrolled.map((row) => row.courseId), ...assigned])];
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

function parseLimit(value: string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_LIST_LIMIT;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
    throw new AppError('VALIDATION_ERROR', `limit 1 ile ${MAX_LIST_LIMIT} arasında bir tam sayı olmalıdır.`, 400);
  }
  return limit;
}

function parseCategory(value: string | undefined): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (!(ANNOUNCEMENT_CATEGORIES as readonly string[]).includes(value)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `category şunlardan biri olmalıdır: ${ANNOUNCEMENT_CATEGORIES.join(', ')}.`,
      400,
    );
  }
  return value;
}

function parseState(value: string | undefined): AnnouncementState | undefined {
  if (value === undefined || value === '') return undefined;
  if (!(ANNOUNCEMENT_STATES as readonly string[]).includes(value)) {
    throw new AppError('VALIDATION_ERROR', `state şunlardan biri olmalıdır: ${ANNOUNCEMENT_STATES.join(', ')}.`, 400);
  }
  return value as AnnouncementState;
}

async function loadAnnouncement(id: string) {
  const announcement = await prisma.announcement.findUnique({ where: { id }, include: announcementInclude });
  if (!announcement) throw new AppError('NOT_FOUND', 'Duyuru bulunamadı.', 404);
  return announcement;
}

const PATCH_FIELDS = ['title', 'body', 'category', 'status', 'publishAt', 'expiresAt', 'pinned', 'courseId'] as const;

export function registerAnnouncementRoutes(app: FastifyInstance) {
  // Okuyucu akışı: yalnızca şu an yayında olan ve kullanıcının görebileceği duyurular.
  app.get<{ Querystring: { courseId?: string; category?: string; limit?: string } }>(
    '/api/v1/announcements',
    { preHandler: [requireAuth] },
    async (request) => {
      const user = request.user!;
      const now = new Date();
      const limit = parseLimit(request.query.limit);
      const category = parseCategory(request.query.category);
      const courseId = request.query.courseId || undefined;

      const assigned = await assignedCourseIds(user);
      const readable = await readableCourseIds(user, assigned);
      const visibility = readable === null ? {} : { OR: [{ courseId: null }, { courseId: { in: readable } }] };

      const announcements = await prisma.announcement.findMany({
        where: {
          AND: [
            liveWhere(now),
            visibility,
            category ? { category } : {},
            courseId ? { courseId } : {},
          ],
        },
        include: announcementInclude,
        orderBy: [{ pinned: 'desc' }, { publishAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
      });

      return {
        announcements: announcements.map((a) =>
          serializeAnnouncement(a, now, canEditAnnouncement(user, a.courseId, assigned)),
        ),
      };
    },
  );

  // Yönetim listesi: taslak, zamanlanmış ve süresi dolmuş duyurular dahil, kullanıcının düzenleyebildikleri.
  app.get<{ Querystring: { state?: string; courseId?: string } }>(
    '/api/v1/announcements/manage',
    { preHandler: [requireAuth, requireRole('ADMIN', 'INSTRUCTOR')] },
    async (request) => {
      const user = request.user!;
      const now = new Date();
      const state = parseState(request.query.state);
      const courseId = request.query.courseId || undefined;

      const assigned = await assignedCourseIds(user);
      const scope = user.role === 'ADMIN' ? {} : { courseId: { in: [...assigned] } };

      const announcements = await prisma.announcement.findMany({
        where: { AND: [scope, courseId ? { courseId } : {}] },
        include: announcementInclude,
        orderBy: [{ updatedAt: 'desc' }],
      });

      return {
        announcements: announcements
          .filter((a) => !state || announcementState(a, now) === state)
          .map((a) => serializeAnnouncement(a, now, true)),
      };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/announcements/:id',
    { preHandler: [requireAuth] },
    async (request) => {
      const user = request.user!;
      const now = new Date();
      const announcement = await loadAnnouncement(request.params.id);
      const assigned = await assignedCourseIds(user);
      const canEdit = canEditAnnouncement(user, announcement.courseId, assigned);

      if (!canEdit) {
        const live = announcementState(announcement, now) === 'PUBLISHED';
        const readable = await readableCourseIds(user, assigned);
        const visible =
          readable === null || announcement.courseId === null || readable.includes(announcement.courseId);
        // Görünmeyen duyurunun varlığı sızdırılmaz.
        if (!live || !visible) throw new AppError('NOT_FOUND', 'Duyuru bulunamadı.', 404);
      }

      return { announcement: serializeAnnouncement(announcement, now, canEdit) };
    },
  );

  app.post<{ Body: unknown }>('/api/v1/announcements', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user!;
    const now = new Date();
    const data = normalizeAnnouncementInput(requireBodyObject(request.body) as RawAnnouncementInput, now);
    if (data.courseId !== null) await assertCourseExists(data.courseId);
    await assertCanWriteTarget(user, data.courseId);

    const created = await prisma.announcement.create({
      data: { ...data, authorId: user.userId },
      include: announcementInclude,
    });
    reply.status(201);
    return { announcement: serializeAnnouncement(created, now, true) };
  });

  app.patch<{ Params: { id: string }; Body: unknown }>(
    '/api/v1/announcements/:id',
    { preHandler: [requireAuth] },
    async (request) => {
      const user = request.user!;
      const now = new Date();
      const existing = await loadAnnouncement(request.params.id);
      await assertCanWriteTarget(user, existing.courseId);

      const body = requireBodyObject(request.body);
      if (!PATCH_FIELDS.some((field) => body[field] !== undefined)) {
        throw new AppError('VALIDATION_ERROR', 'Güncellenecek en az bir alan gönderilmelidir.', 400);
      }

      const merged: Record<string, unknown> = { ...toRawInput(existing) };
      for (const field of PATCH_FIELDS) {
        if (body[field] !== undefined) merged[field] = body[field];
      }
      // Taslak yayına alınırken tarih verilmediyse eski (geçmiş) bir publishAt yerine şimdi yayınlanır.
      if (existing.status === 'DRAFT' && merged.status === 'PUBLISHED' && body.publishAt === undefined) {
        merged.publishAt = null;
      }

      const data = normalizeAnnouncementInput(merged as RawAnnouncementInput, now);
      if (data.courseId !== existing.courseId) {
        if (data.courseId !== null) await assertCourseExists(data.courseId);
        await assertCanWriteTarget(user, data.courseId);
      }

      const updated = await prisma.announcement.update({
        where: { id: existing.id },
        data,
        include: announcementInclude,
      });
      const canEdit = canEditAnnouncement(user, updated.courseId, await assignedCourseIds(user));
      return { announcement: serializeAnnouncement(updated, now, canEdit) };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/announcements/:id',
    { preHandler: [requireAuth] },
    async (request) => {
      const existing = await loadAnnouncement(request.params.id);
      await assertCanWriteTarget(request.user!, existing.courseId);
      // deleteMany: eşzamanlı silmede P2025 yerine idempotent davranır.
      await prisma.announcement.deleteMany({ where: { id: existing.id } });
      return { deleted: true };
    },
  );
}

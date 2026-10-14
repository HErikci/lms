import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { parseRoles } from '../lib/users.js';
import { buildGuardianReport, guardianLinkInclude, isMinor, linkIsAccessible, requireGuardianLink } from '../lib/guardians.js';
import { sendGuardianReport } from '../lib/guardianNotifications.js';

function bodyObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError('VALIDATION_ERROR', 'İstek gövdesi bir nesne olmalıdır.', 400);
  return body as Record<string, unknown>;
}
function preferences(body: Record<string, unknown>) {
  const data: { phone?: string | null; emailEnabled?: boolean; smsEnabled?: boolean } = {};
  for (const key of ['emailEnabled', 'smsEnabled'] as const) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'boolean') throw new AppError('VALIDATION_ERROR', 'Bildirim tercihleri boolean olmalıdır.', 400);
      data[key] = body[key];
    }
  }
  if (body.phone !== undefined) {
    if (body.phone === null || body.phone === '') data.phone = null;
    else if (typeof body.phone === 'string' && /^\+[1-9]\d{7,14}$/.test(body.phone.trim())) data.phone = body.phone.trim();
    else throw new AppError('VALIDATION_ERROR', 'Telefon numarasını ülke koduyla girin (ör. +905551234567).', 400);
  }
  return data;
}
function channelFrom(body: unknown): 'EMAIL' | 'SMS' {
  const channel = bodyObject(body).channel;
  if (channel !== 'EMAIL' && channel !== 'SMS') throw new AppError('VALIDATION_ERROR', 'Kanal EMAIL veya SMS olmalıdır.', 400);
  return channel;
}

type Link = Prisma.GuardianLinkGetPayload<{ include: typeof guardianLinkInclude }>;
function serializeLink(link: Link) {
  return { id: link.id,
    student: { id: link.student.id, name: link.student.name, email: link.student.email, birthDate: link.student.birthDate?.toISOString().slice(0, 10) ?? null },
    guardian: { id: link.guardian.id, name: link.guardian.name, email: link.guardian.email },
    phone: link.phone, emailEnabled: link.emailEnabled, smsEnabled: link.smsEnabled, createdAt: link.createdAt.toISOString() };
}

export function registerGuardianRoutes(app: FastifyInstance) {
  const adminOnly = { preHandler: [requireAuth, requireRole('ADMIN')] };
  const guardianOnly = { preHandler: [requireAuth, requireRole('GUARDIAN')] };

  app.get('/api/v1/admin/guardians/options', adminOnly, async () => {
    const users = await prisma.user.findMany({
      where: { disabledAt: null, OR: [{ roles: { contains: 'STUDENT' } }, { roles: { contains: 'GUARDIAN' } }] },
      select: { id: true, name: true, email: true, birthDate: true, role: true, roles: true }, orderBy: { name: 'asc' },
    });
    return {
      students: users.filter((user) => parseRoles(user).includes('STUDENT')).map((user) => ({ id: user.id, name: user.name, email: user.email, birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null, isMinor: isMinor(user.birthDate) })),
      guardians: users.filter((user) => parseRoles(user).includes('GUARDIAN')).map((user) => ({ id: user.id, name: user.name, email: user.email })),
    };
  });
  app.get('/api/v1/admin/guardians', adminOnly, async () => ({
    links: (await prisma.guardianLink.findMany({ include: guardianLinkInclude, orderBy: { createdAt: 'desc' } })).map(serializeLink),
  }));

  app.post('/api/v1/admin/guardians', adminOnly, async (request, reply) => {
    const body = bodyObject(request.body);
    if (typeof body.studentId !== 'string' || typeof body.guardianId !== 'string' || body.studentId === body.guardianId) {
      throw new AppError('VALIDATION_ERROR', 'Farklı bir öğrenci ve veli hesabı seçin.', 400);
    }
    const data = preferences(body);
    if (data.smsEnabled && !data.phone) throw new AppError('VALIDATION_ERROR', 'SMS için telefon numarası zorunludur.', 400);
    const created = await prisma.$transaction(async (db) => {
      const [student, guardian] = await Promise.all([
        db.user.findUnique({ where: { id: body.studentId as string } }),
        db.user.findUnique({ where: { id: body.guardianId as string } }),
      ]);
      if (!student || student.disabledAt || !parseRoles(student).includes('STUDENT') || !isMinor(student.birthDate)) {
        throw new AppError('NOT_A_MINOR_STUDENT', 'Doğum tarihi kayıtlı, aktif ve 18 yaş altındaki bir öğrenci seçin.', 400);
      }
      if (!guardian || guardian.disabledAt || !parseRoles(guardian).includes('GUARDIAN')) {
        throw new AppError('NOT_A_GUARDIAN', 'Aktif bir veli hesabı seçin.', 400);
      }
      return db.guardianLink.create({ data: { studentId: student.id, guardianId: guardian.id, ...data }, include: guardianLinkInclude });
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('GUARDIAN_ALREADY_LINKED', 'Bu veli öğrenciye zaten bağlı.', 409);
      }
      throw error;
    });
    reply.status(201);
    return { link: serializeLink(created) };
  });

  app.delete<{ Params: { id: string } }>('/api/v1/admin/guardians/:id', adminOnly, async (request) => {
    await prisma.guardianLink.deleteMany({ where: { id: request.params.id } });
    return { success: true };
  });
  app.post<{ Params: { id: string } }>('/api/v1/admin/guardians/:id/notify', adminOnly, async (request) => {
    const channel = channelFrom(request.body);
    const link = await prisma.guardianLink.findUnique({ where: { id: request.params.id }, include: guardianLinkInclude });
    if (!link || !linkIsAccessible(link)) throw new AppError('NOT_FOUND', 'Aktif veli ilişkisi bulunamadı.', 404);
    return { notification: await sendGuardianReport(link.id, channel, await buildGuardianReport(link.studentId)) };
  });

  app.get('/api/v1/guardian/children', guardianOnly, async (request) => {
    const links = await prisma.guardianLink.findMany({ where: { guardianId: request.user!.userId }, include: guardianLinkInclude, orderBy: { createdAt: 'asc' } });
    return { children: await Promise.all(links.filter(linkIsAccessible).map(async (link) => ({
      link: { id: link.id, phone: link.phone, emailEnabled: link.emailEnabled, smsEnabled: link.smsEnabled },
      report: await buildGuardianReport(link.studentId),
    }))) };
  });
  app.patch<{ Params: { id: string } }>('/api/v1/guardian/links/:id', guardianOnly, async (request) => {
    const link = await prisma.guardianLink.findFirst({ where: { id: request.params.id, guardianId: request.user!.userId }, include: guardianLinkInclude });
    if (!link || !linkIsAccessible(link)) throw new AppError('NOT_FOUND', 'Veli ilişkisi bulunamadı.', 404);
    const data = preferences(bodyObject(request.body));
    if (Object.keys(data).length === 0) throw new AppError('VALIDATION_ERROR', 'Güncellenecek bir bildirim tercihi gönderin.', 400);
    if ((data.smsEnabled ?? link.smsEnabled) && !(data.phone === undefined ? link.phone : data.phone)) throw new AppError('VALIDATION_ERROR', 'SMS için telefon numarası zorunludur.', 400);
    const updated = await prisma.guardianLink.update({ where: { id: link.id }, data, include: guardianLinkInclude });
    return { link: serializeLink(updated) };
  });
  app.post<{ Params: { studentId: string } }>('/api/v1/guardian/children/:studentId/notify', guardianOnly, async (request) => {
    const channel = channelFrom(request.body);
    const link = await requireGuardianLink(request.params.studentId, request.user!.userId);
    return { notification: await sendGuardianReport(link.id, channel, await buildGuardianReport(link.studentId)) };
  });
  app.get('/api/v1/guardian/notifications', guardianOnly, async (request) => {
    const links = await prisma.guardianLink.findMany({ where: { guardianId: request.user!.userId }, include: guardianLinkInclude });
    const rows = await prisma.guardianNotification.findMany({
      where: { linkId: { in: links.filter(linkIsAccessible).map((link) => link.id) } },
      include: { link: { select: { student: { select: { id: true, name: true } } } } }, orderBy: { createdAt: 'desc' }, take: 50,
    });
    return { notifications: rows.map((row) => ({ id: row.id, channel: row.channel, status: row.status, error: row.error,
      createdAt: row.createdAt.toISOString(), sentAt: row.sentAt?.toISOString() ?? null, student: row.link.student })) };
  });
}

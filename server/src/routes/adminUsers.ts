import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { AppError } from '../errors.js';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  ROLE_ORDER,
  adminUserCount,
  defaultActiveRole,
  parseEmailInput,
  parseNameInput,
  parsePasswordInput,
  parseRoleInput,
  parseRoles,
  serializeAdminUser,
  serializeRoles,
  type Role,
} from '../lib/users.js';

interface ListQuery {
  q?: string;
  role?: string;
  status?: string;
  page?: string;
  pageSize?: string;
}

const STATUSES = ['ACTIVE', 'DISABLED'] as const;
const PATCH_FIELDS = ['name', 'email', 'roles', 'password', 'disabled'] as const;

function validation(message: string): AppError {
  return new AppError('VALIDATION_ERROR', message, 400);
}

function parsePositiveInt(value: string | undefined, field: string, fallback: number, max?: number): number {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || (max !== undefined && n > max)) {
    throw validation(max ? `${field} 1 ile ${max} arasında bir tam sayı olmalıdır.` : `${field} pozitif bir tam sayı olmalıdır.`);
  }
  return n;
}

function requireBodyObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw validation('İstek gövdesi bir nesne olmalıdır.');
  }
  return body as Record<string, unknown>;
}

async function assertEmailFree(email: string, exceptId?: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing && existing.id !== exceptId) {
    throw new AppError('EMAIL_TAKEN', 'Bu e-posta ile zaten bir hesap var.', 409);
  }
}

export function registerAdminUserRoutes(app: FastifyInstance) {
  const adminOnly = { preHandler: [requireAuth, requireRole('ADMIN')] };

  app.get<{ Querystring: ListQuery }>('/api/v1/admin/users', adminOnly, async (request) => {
    const { q, role, status } = request.query;
    const page = parsePositiveInt(request.query.page, 'page', 1);
    const pageSize = parsePositiveInt(request.query.pageSize, 'pageSize', DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    if (role && !(ROLE_ORDER as readonly string[]).includes(role)) {
      throw validation(`role şunlardan biri olmalıdır: ${ROLE_ORDER.join(', ')}.`);
    }
    if (status && !(STATUSES as readonly string[]).includes(status)) {
      throw validation(`status şunlardan biri olmalıdır: ${STATUSES.join(', ')}.`);
    }

    const term = q?.trim();
    const where = {
      AND: [
        term ? { OR: [{ name: { contains: term } }, { email: { contains: term } }] } : {},
        // Rol adları birbirinin alt dizesi olmadığından CSV üzerinde contains güvenlidir.
        role ? { roles: { contains: role } } : {},
        status === 'ACTIVE' ? { disabledAt: null } : status === 'DISABLED' ? { disabledAt: { not: null } } : {},
      ],
    };

    const [users, total, all, disabled, students, instructors, admins] = await Promise.all([
      prisma.user.findMany({
        where,
        include: adminUserCount,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
      prisma.user.count(),
      prisma.user.count({ where: { disabledAt: { not: null } } }),
      prisma.user.count({ where: { roles: { contains: 'STUDENT' } } }),
      prisma.user.count({ where: { roles: { contains: 'INSTRUCTOR' } } }),
      prisma.user.count({ where: { roles: { contains: 'ADMIN' } } }),
    ]);

    return {
      users: users.map(serializeAdminUser),
      total,
      page,
      pageSize,
      summary: { total: all, disabled, students, instructors, admins },
    };
  });

  app.post<{ Body: unknown }>('/api/v1/admin/users', adminOnly, async (request, reply) => {
    const body = requireBodyObject(request.body);
    const name = parseNameInput(body.name);
    const email = parseEmailInput(body.email);
    const password = parsePasswordInput(body.password);
    const roles = parseRoleInput(body.roles ?? ['STUDENT']);
    await assertEmailFree(email);

    const created = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await bcrypt.hash(password, 12),
        roles: serializeRoles(roles),
        role: defaultActiveRole(roles),
      },
      include: adminUserCount,
    });
    reply.status(201);
    return { user: serializeAdminUser(created) };
  });

  app.patch<{ Params: { id: string }; Body: unknown }>('/api/v1/admin/users/:id', adminOnly, async (request) => {
    const body = requireBodyObject(request.body);
    if (!PATCH_FIELDS.some((field) => body[field] !== undefined)) {
      throw validation('Güncellenecek en az bir alan gönderilmelidir.');
    }

    const existing = await prisma.user.findUnique({ where: { id: request.params.id }, include: adminUserCount });
    if (!existing) throw new AppError('NOT_FOUND', 'Kullanıcı bulunamadı.', 404);
    const isSelf = existing.id === request.user!.userId;

    const data: {
      name?: string;
      email?: string;
      roles?: string;
      role?: Role;
      passwordHash?: string;
      disabledAt?: Date | null;
    } = {};

    if (body.name !== undefined) data.name = parseNameInput(body.name);
    if (body.email !== undefined) {
      data.email = parseEmailInput(body.email);
      await assertEmailFree(data.email, existing.id);
    }
    if (body.password !== undefined) data.passwordHash = await bcrypt.hash(parsePasswordInput(body.password), 12);

    const currentRoles = parseRoles(existing);
    let nextRoles = currentRoles;
    if (body.roles !== undefined) {
      nextRoles = parseRoleInput(body.roles);
      data.roles = serializeRoles(nextRoles);
      // Aktif rol geri alındıysa en az yetkili role düşülür; o rolle açılmış oturumlar reddedilir.
      if (!nextRoles.includes(existing.role as Role)) data.role = defaultActiveRole(nextRoles);
    }

    let disable = Boolean(existing.disabledAt);
    if (body.disabled !== undefined) {
      if (typeof body.disabled !== 'boolean') throw validation('disabled boolean olmalıdır.');
      disable = body.disabled;
      if (disable !== Boolean(existing.disabledAt)) data.disabledAt = disable ? new Date() : null;
    }

    // İşlemi yapan her zaman etkin bir yöneticidir; kendini kilitleyemediği için sistemde
    // en az bir etkin yönetici kalması da bu kuralla güvence altındadır.
    const losesAdmin = currentRoles.includes('ADMIN') && !nextRoles.includes('ADMIN');
    if (isSelf && (losesAdmin || (disable && !existing.disabledAt))) {
      throw new AppError('SELF_LOCKOUT', 'Kendi yönetici yetkinizi kaldıramaz veya hesabınızı devre dışı bırakamazsınız.', 409);
    }
    if (
      currentRoles.includes('INSTRUCTOR') &&
      !nextRoles.includes('INSTRUCTOR') &&
      existing._count.instructorAssignments > 0
    ) {
      throw new AppError(
        'INSTRUCTOR_HAS_COURSES',
        `Kullanıcı ${existing._count.instructorAssignments} kursta eğitmen. Önce kurs atamalarını kaldırın.`,
        409,
      );
    }

    const updated = await prisma.user.update({ where: { id: existing.id }, data, include: adminUserCount });
    return { user: serializeAdminUser(updated) };
  });
}

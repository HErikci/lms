import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { AppError } from '../errors.js';

const VALID_ROLES = ['STUDENT', 'INSTRUCTOR', 'ADMIN'] as const;
type Role = (typeof VALID_ROLES)[number];

interface CreateNavItemBody {
  path: string;
  label: string;
  icon: string;
  order: number;
  roles: Role[];
}

interface UpdateNavItemBody {
  path?: string;
  label?: string;
  icon?: string;
  order?: number;
  roles?: Role[];
}

function toPublicNavItem(item: {
  id: string;
  path: string;
  label: string;
  icon: string;
  order: number;
  roles: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: item.id,
    path: item.path,
    label: item.label,
    icon: item.icon,
    order: item.order,
    roles: item.roles ? item.roles.split(',') : [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function validateRoles(roles: unknown): roles is Role[] {
  return (
    Array.isArray(roles) &&
    roles.length > 0 &&
    roles.every((role) => VALID_ROLES.includes(role as Role))
  );
}

export function registerNavItemRoutes(app: FastifyInstance) {
  app.get('/api/v1/nav-items/me', { preHandler: [requireAuth] }, async (request) => {
    const role = request.user!.role;
    const items = await prisma.navMenuItem.findMany({ orderBy: { order: 'asc' } });
    const visible = items.filter((item) => item.roles.split(',').includes(role));
    return {
      items: visible.map((item) => ({
        path: item.path,
        label: item.label,
        icon: item.icon,
      })),
    };
  });

  app.get(
    '/api/v1/admin/nav-items',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async () => {
      const items = await prisma.navMenuItem.findMany({ orderBy: { order: 'asc' } });
      return { items: items.map(toPublicNavItem) };
    },
  );

  app.post<{ Body: CreateNavItemBody }>(
    '/api/v1/admin/nav-items',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request, reply) => {
      const { path, label, icon, order, roles } = request.body ?? ({} as CreateNavItemBody);

      if (!path || !label || !icon || order === undefined || order === null) {
        throw new AppError(
          'VALIDATION_ERROR',
          'path, label, icon ve order alanları zorunludur.',
          400,
        );
      }
      if (!validateRoles(roles)) {
        throw new AppError(
          'VALIDATION_ERROR',
          `roles alanı geçerli rollerden oluşan bir dizi olmalıdır: ${VALID_ROLES.join(', ')}.`,
          400,
        );
      }

      const created = await prisma.navMenuItem.create({
        data: {
          path,
          label,
          icon,
          order,
          roles: roles.join(','),
        },
      });
      reply.status(201);
      return { item: toPublicNavItem(created) };
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateNavItemBody }>(
    '/api/v1/admin/nav-items/:id',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request) => {
      const existing = await prisma.navMenuItem.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Menü öğesi bulunamadı.', 404);
      }

      const { path, label, icon, order, roles } = request.body ?? {};

      if (roles !== undefined && !validateRoles(roles)) {
        throw new AppError(
          'VALIDATION_ERROR',
          `roles alanı geçerli rollerden oluşan bir dizi olmalıdır: ${VALID_ROLES.join(', ')}.`,
          400,
        );
      }

      const updated = await prisma.navMenuItem.update({
        where: { id: existing.id },
        data: {
          ...(path !== undefined ? { path } : {}),
          ...(label !== undefined ? { label } : {}),
          ...(icon !== undefined ? { icon } : {}),
          ...(order !== undefined ? { order } : {}),
          ...(roles !== undefined ? { roles: roles.join(',') } : {}),
        },
      });
      return { item: toPublicNavItem(updated) };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/admin/nav-items/:id',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request) => {
      const existing = await prisma.navMenuItem.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Menü öğesi bulunamadı.', 404);
      }
      await prisma.navMenuItem.delete({ where: { id: existing.id } });
      return { success: true };
    },
  );
}

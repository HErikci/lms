import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/rbac.js';
import { toPublicUser } from '../lib/publicUser.js';
import { AppError } from '../errors.js';

const ALLOWED_LOCALES = ['tr', 'en'];

interface UpdateMeBody {
  name?: string;
  avatarUrl?: string | null;
  locale?: string;
}

export function registerUserRoutes(app: FastifyInstance) {
  app.patch<{ Body: UpdateMeBody }>(
    '/api/v1/users/me',
    { preHandler: [requireAuth] },
    async (request) => {
      const { name, avatarUrl, locale } = request.body ?? {};

      if (locale !== undefined && !ALLOWED_LOCALES.includes(locale)) {
        throw new AppError(
          'INVALID_LOCALE',
          `Geçersiz dil seçeneği. Desteklenenler: ${ALLOWED_LOCALES.join(', ')}.`,
          400,
        );
      }

      const data: { name?: string; avatarUrl?: string | null; locale?: string } = {};
      if (name !== undefined) data.name = name;
      if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
      if (locale !== undefined) data.locale = locale;

      const user =
        Object.keys(data).length > 0
          ? await prisma.user.update({ where: { id: request.user!.userId }, data })
          : await prisma.user.findUniqueOrThrow({ where: { id: request.user!.userId } });

      return { user: toPublicUser(user) };
    },
  );
}

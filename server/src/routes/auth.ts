import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { signToken, type TokenPayload } from '../lib/jwt.js';
import { requireAuth } from '../middleware/rbac.js';
import { AppError } from '../errors.js';
import { toPublicUser } from '../lib/publicUser.js';
import { parseRoles } from '../lib/users.js';
import { parseBirthDate } from '../lib/guardians.js';

interface RegisterBody {
  email: string;
  password: string;
  name: string;
  birthDate?: string | null;
}

interface LoginBody {
  email: string;
  password: string;
}

interface SwitchRoleBody {
  role: TokenPayload['role'];
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.post<{ Body: RegisterBody }>('/api/v1/auth/register', async (request) => {
    const { email, password, name } = request.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new AppError('INVALID_EMAIL', 'Geçerli bir e-posta adresi girin.', 400);
    }
    if (typeof password !== 'string' || password.length < 8) {
      throw new AppError('WEAK_PASSWORD', 'Şifre en az 8 karakter olmalıdır.', 400);
    }
    if (!name || name.trim().length === 0) {
      throw new AppError('INVALID_NAME', 'Ad soyad boş olamaz.', 400);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('EMAIL_TAKEN', 'Bu e-posta ile zaten bir hesap var.', 409);
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: 'STUDENT', roles: 'STUDENT', birthDate: request.body.birthDate === undefined ? null : parseBirthDate(request.body.birthDate) },
    });
    const roles = parseRoles(user);
    const token = signToken({ userId: user.id, role: user.role as TokenPayload['role'], roles });
    return { user: toPublicUser(user), token };
  });

  app.post<{ Body: LoginBody }>('/api/v1/auth/login', async (request) => {
    const { email, password } = request.body;
    const user = await prisma.user.findUnique({ where: { email } });
    const genericError = () =>
      new AppError('INVALID_CREDENTIALS', 'E-posta veya şifre hatalı.', 401);
    if (!user) throw genericError();
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw genericError();
    // Yalnızca doğru şifreden sonra söylenir; aksi halde hesabın varlığı sızar.
    if (user.disabledAt) {
      throw new AppError('ACCOUNT_DISABLED', 'Hesabınız devre dışı bırakılmış. Yöneticinizle iletişime geçin.', 403);
    }
    const roles = parseRoles(user);
    const token = signToken({ userId: user.id, role: user.role as TokenPayload['role'], roles });
    return { user: toPublicUser(user), token };
  });

  app.get(
    '/api/v1/auth/me',
    { preHandler: [requireAuth] },
    async (request) => {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user!.userId } });
      return { user: toPublicUser(user) };
    },
  );

  app.post<{ Body: SwitchRoleBody }>(
    '/api/v1/auth/switch-role',
    { preHandler: [requireAuth] },
    async (request) => {
      const { role: requestedRole } = request.body ?? {};
      const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user!.userId } });
      const roles = parseRoles(user);

      if (!roles.includes(requestedRole)) {
        throw new AppError('ROLE_NOT_ASSIGNED', 'Bu role sahip değilsiniz.', 403);
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { role: requestedRole },
      });

      const token = signToken({ userId: updatedUser.id, role: requestedRole, roles });
      return { user: toPublicUser(updatedUser), token };
    },
  );
}

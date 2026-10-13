import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { signToken, type TokenPayload } from '../lib/jwt.js';
import { requireAuth } from '../middleware/rbac.js';
import { AppError } from '../errors.js';

interface RegisterBody {
  email: string;
  password: string;
  name: string;
}

interface LoginBody {
  email: string;
  password: string;
}

function toPublicUser(user: { id: string; email: string; name: string; role: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.post<{ Body: RegisterBody }>('/api/v1/auth/register', async (request) => {
    const { email, password, name } = request.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('EMAIL_TAKEN', 'Bu e-posta ile zaten bir hesap var.', 409);
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: 'STUDENT' },
    });
    const token = signToken({ userId: user.id, role: user.role as TokenPayload['role'] });
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
    const token = signToken({ userId: user.id, role: user.role as TokenPayload['role'] });
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
}

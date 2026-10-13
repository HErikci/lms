import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyToken, type TokenPayload } from '../lib/jwt.js';
import { AppError } from '../errors.js';
import { prisma } from '../lib/prisma.js';
import { parseRoles } from '../lib/users.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

/**
 * Token'ı doğrular ve kullanıcının hâlâ geçerli olduğunu DB'den kontrol eder: hesap silinmiş ya da
 * devre dışıysa veya token'daki aktif rol kullanıcıdan geri alınmışsa null döner. Böylece yönetici
 * değişiklikleri token süresinin dolmasını beklemeden etkili olur. Rol listesi DB'den tazelenir.
 */
async function resolveSession(header: string | undefined): Promise<TokenPayload | null> {
  if (!header?.startsWith('Bearer ')) return null;
  let payload: TokenPayload;
  try {
    payload = verifyToken(header.slice('Bearer '.length));
  } catch {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true, roles: true, disabledAt: true },
  });
  if (!user || user.disabledAt) return null;
  // `role` sütunu (aktif rol) yalnızca roles'e karşı doğrulanarak yazılır (switch-role, yönetim PATCH);
  // eski/fixture kayıtlarda roles'te eksik olabileceğinden sahip olunan rol sayılır.
  const roles = parseRoles(user);
  if (!roles.includes(user.role as TokenPayload['role'])) roles.push(user.role as TokenPayload['role']);
  if (!roles.includes(payload.role)) return null;
  return { userId: payload.userId, role: payload.role, roles };
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  const session = await resolveSession(request.headers.authorization);
  if (!session) {
    throw new AppError('UNAUTHORIZED', 'Giriş yapmanız gerekiyor.', 401);
  }
  request.user = session;
}

export async function tryAuth(request: FastifyRequest, _reply: FastifyReply) {
  // Geçersiz/eskimiş oturum -> kimliksiz devam edilir.
  request.user = (await resolveSession(request.headers.authorization)) ?? undefined;
}

export function requireRole(...roles: TokenPayload['role'][]) {
  return async function (request: FastifyRequest, _reply: FastifyReply) {
    if (!request.user || !roles.includes(request.user.role)) {
      throw new AppError('FORBIDDEN', 'Bu işlem için yetkiniz yok.', 403);
    }
  };
}

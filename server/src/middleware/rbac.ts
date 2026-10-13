import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyToken, type TokenPayload } from '../lib/jwt.js';
import { AppError } from '../errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError('UNAUTHORIZED', 'Giriş yapmanız gerekiyor.', 401);
  }
  const token = header.slice('Bearer '.length);
  try {
    request.user = verifyToken(token);
  } catch {
    throw new AppError('UNAUTHORIZED', 'Giriş yapmanız gerekiyor.', 401);
  }
}

export async function tryAuth(request: FastifyRequest, _reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return;
  }
  const token = header.slice('Bearer '.length);
  try {
    request.user = verifyToken(token);
  } catch {
    // no valid token -> proceed unauthenticated
  }
}

export function requireRole(...roles: TokenPayload['role'][]) {
  return async function (request: FastifyRequest, _reply: FastifyReply) {
    if (!request.user || !roles.includes(request.user.role)) {
      throw new AppError('FORBIDDEN', 'Bu işlem için yetkiniz yok.', 403);
    }
  };
}

import { describe, it, expect, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { signToken } from '../lib/jwt.js';
import { requireAuth, requireRole } from './rbac.js';

function mockReqRes(headers: Record<string, string> = {}) {
  const request = { headers } as unknown as FastifyRequest & { user?: unknown };
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as FastifyReply;
  return { request, reply };
}

describe('requireAuth', () => {
  it('attaches request.user for a valid bearer token', async () => {
    const token = signToken({ userId: 'u1', role: 'STUDENT' });
    const { request, reply } = mockReqRes({ authorization: `Bearer ${token}` });
    await requireAuth(request, reply);
    expect((request as any).user).toEqual({ userId: 'u1', role: 'STUDENT' });
  });

  it('rejects a missing token', async () => {
    const { request, reply } = mockReqRes();
    await expect(requireAuth(request, reply)).rejects.toThrow();
  });
});

describe('requireRole', () => {
  it('allows a matching role', async () => {
    const token = signToken({ userId: 'u1', role: 'INSTRUCTOR' });
    const { request, reply } = mockReqRes({ authorization: `Bearer ${token}` });
    await requireAuth(request, reply);
    await expect(requireRole('INSTRUCTOR', 'ADMIN')(request, reply)).resolves.not.toThrow();
  });

  it('rejects a non-matching role', async () => {
    const token = signToken({ userId: 'u1', role: 'STUDENT' });
    const { request, reply } = mockReqRes({ authorization: `Bearer ${token}` });
    await requireAuth(request, reply);
    await expect(requireRole('INSTRUCTOR', 'ADMIN')(request, reply)).rejects.toThrow();
  });
});

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { signToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole, tryAuth } from './rbac.js';

function mockReqRes(headers: Record<string, string> = {}) {
  const request = { headers } as unknown as FastifyRequest & { user?: unknown };
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as FastifyReply;
  return { request, reply };
}

async function makeUser(roles: string, role: string) {
  return prisma.user.create({
    data: { email: `${roles.toLowerCase().replace(/,/g, '-')}@example.com`, passwordHash: 'x', name: 'Test', role, roles },
  });
}

beforeEach(async () => {
  await prisma.courseInstructor.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('requireAuth', () => {
  it('attaches request.user for a valid bearer token', async () => {
    const user = await makeUser('STUDENT', 'STUDENT');
    const token = signToken({ userId: user.id, role: 'STUDENT', roles: ['STUDENT'] });
    const { request, reply } = mockReqRes({ authorization: `Bearer ${token}` });
    await requireAuth(request, reply);
    expect((request as any).user).toEqual({ userId: user.id, role: 'STUDENT', roles: ['STUDENT'] });
  });

  it('rejects a missing token', async () => {
    const { request, reply } = mockReqRes();
    await expect(requireAuth(request, reply)).rejects.toThrow();
  });

  it('rejects a token for a user that no longer exists', async () => {
    const token = signToken({ userId: 'missing', role: 'STUDENT', roles: ['STUDENT'] });
    const { request, reply } = mockReqRes({ authorization: `Bearer ${token}` });
    await expect(requireAuth(request, reply)).rejects.toThrow();
  });

  it('rejects a disabled user immediately', async () => {
    const user = await makeUser('STUDENT', 'STUDENT');
    const token = signToken({ userId: user.id, role: 'STUDENT', roles: ['STUDENT'] });
    await prisma.user.update({ where: { id: user.id }, data: { disabledAt: new Date() } });
    const { request, reply } = mockReqRes({ authorization: `Bearer ${token}` });
    await expect(requireAuth(request, reply)).rejects.toThrow();
  });

  it('rejects a token whose active role was revoked and refreshes roles from the DB', async () => {
    const user = await makeUser('STUDENT,ADMIN', 'ADMIN');
    const adminToken = signToken({ userId: user.id, role: 'ADMIN', roles: ['STUDENT', 'ADMIN'] });
    const studentToken = signToken({ userId: user.id, role: 'STUDENT', roles: ['STUDENT', 'ADMIN'] });
    await prisma.user.update({ where: { id: user.id }, data: { roles: 'STUDENT', role: 'STUDENT' } });

    const admin = mockReqRes({ authorization: `Bearer ${adminToken}` });
    await expect(requireAuth(admin.request, admin.reply)).rejects.toThrow();

    const student = mockReqRes({ authorization: `Bearer ${studentToken}` });
    await requireAuth(student.request, student.reply);
    expect((student.request as any).user.roles).toEqual(['STUDENT']);
  });
});

describe('tryAuth', () => {
  it('proceeds unauthenticated for a disabled user', async () => {
    const user = await makeUser('STUDENT', 'STUDENT');
    await prisma.user.update({ where: { id: user.id }, data: { disabledAt: new Date() } });
    const token = signToken({ userId: user.id, role: 'STUDENT', roles: ['STUDENT'] });
    const { request, reply } = mockReqRes({ authorization: `Bearer ${token}` });
    await tryAuth(request, reply);
    expect((request as any).user).toBeUndefined();
  });
});

describe('requireRole', () => {
  it('allows a matching role', async () => {
    const user = await makeUser('INSTRUCTOR', 'INSTRUCTOR');
    const token = signToken({ userId: user.id, role: 'INSTRUCTOR', roles: ['INSTRUCTOR'] });
    const { request, reply } = mockReqRes({ authorization: `Bearer ${token}` });
    await requireAuth(request, reply);
    await expect(requireRole('INSTRUCTOR', 'ADMIN')(request, reply)).resolves.not.toThrow();
  });

  it('rejects a non-matching role', async () => {
    const user = await makeUser('STUDENT', 'STUDENT');
    const token = signToken({ userId: user.id, role: 'STUDENT', roles: ['STUDENT'] });
    const { request, reply } = mockReqRes({ authorization: `Bearer ${token}` });
    await requireAuth(request, reply);
    await expect(requireRole('INSTRUCTOR', 'ADMIN')(request, reply)).rejects.toThrow();
  });
});

import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from './jwt.js';

describe('jwt helpers', () => {
  it('round-trips a payload', () => {
    const token = signToken({ userId: 'user_1', role: 'STUDENT', roles: ['STUDENT'] });
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('user_1');
    expect(decoded.role).toBe('STUDENT');
  });

  it('throws on an invalid token', () => {
    expect(() => verifyToken('not-a-real-token')).toThrow();
  });
});

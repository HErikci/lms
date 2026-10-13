import jwt from 'jsonwebtoken';

type Role = 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';

export interface TokenPayload {
  userId: string;
  role: Role;
}

const SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1h';

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, SECRET) as TokenPayload & { iat: number; exp: number };
  return { userId: decoded.userId, role: decoded.role };
}

import { AppError } from '../errors.js';
import type { TokenPayload } from './jwt.js';
import { toPublicUser } from './publicUser.js';

export type Role = TokenPayload['role'];

/** Kanonik rol sırası: en az yetkiliden en çoğa. CSV bu sırayla yazılır; varsayılan aktif rol ilk sahip olunandır. */
export const ROLE_ORDER: readonly Role[] = ['STUDENT', 'INSTRUCTOR', 'ADMIN'];

export const MAX_NAME = 100;
export const MIN_PASSWORD = 8;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** User.roles CSV'sini (boşsa tekil role alanını) rol listesine çevirir. */
export function parseRoles(user: { role: string; roles?: string | null }): Role[] {
  const raw = user.roles && user.roles.length > 0 ? user.roles : user.role;
  return raw
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean) as Role[];
}

export function serializeRoles(roles: readonly Role[]): string {
  return ROLE_ORDER.filter((role) => roles.includes(role)).join(',');
}

/** Rol listesinden varsayılan aktif rol: en az yetkili olan. */
export function defaultActiveRole(roles: readonly Role[]): Role {
  return ROLE_ORDER.find((role) => roles.includes(role)) ?? 'STUDENT';
}

function validation(message: string): AppError {
  return new AppError('VALIDATION_ERROR', message, 400);
}

/** İstek gövdesindeki rol dizisini doğrular: boş olmayan, bilinen ve tekrarsız roller. */
export function parseRoleInput(value: unknown): Role[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw validation('roles en az bir rol içeren bir dizi olmalıdır.');
  }
  const roles = new Set<Role>();
  for (const role of value) {
    if (typeof role !== 'string' || !(ROLE_ORDER as readonly string[]).includes(role)) {
      throw validation(`roles yalnızca şunları içerebilir: ${ROLE_ORDER.join(', ')}.`);
    }
    roles.add(role as Role);
  }
  return ROLE_ORDER.filter((role) => roles.has(role));
}

export function parseNameInput(value: unknown): string {
  if (typeof value !== 'string') throw validation('name zorunludur.');
  const name = value.trim();
  if (name.length < 1 || name.length > MAX_NAME) {
    throw validation(`name 1 ile ${MAX_NAME} karakter arasında olmalıdır.`);
  }
  return name;
}

export function parseEmailInput(value: unknown): string {
  const email = typeof value === 'string' ? value.trim() : '';
  if (!EMAIL_RE.test(email)) throw new AppError('INVALID_EMAIL', 'Geçerli bir e-posta adresi girin.', 400);
  return email;
}

export function parsePasswordInput(value: unknown): string {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD) {
    throw new AppError('WEAK_PASSWORD', `Şifre en az ${MIN_PASSWORD} karakter olmalıdır.`, 400);
  }
  return value;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  roles: string;
  avatarUrl: string | null;
  locale: string;
  disabledAt: Date | null;
  createdAt: Date;
  _count: { enrollments: number; instructorAssignments: number };
}

/** Yönetim listesindeki kullanıcı: genel profil + durum + ilişkili kayıt sayıları. */
export function serializeAdminUser(user: AdminUserRow) {
  return {
    ...toPublicUser(user),
    status: user.disabledAt ? 'DISABLED' : 'ACTIVE',
    disabledAt: user.disabledAt?.toISOString() ?? null,
    enrollmentCount: user._count.enrollments,
    teachingCount: user._count.instructorAssignments,
  };
}

export const adminUserCount = {
  _count: { select: { enrollments: true, instructorAssignments: true } },
} as const;

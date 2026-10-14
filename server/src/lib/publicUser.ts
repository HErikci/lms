export function toPublicUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  roles?: string | null;
  avatarUrl: string | null;
  locale: string;
  createdAt: Date;
  birthDate?: Date | null;
}) {
  const parsedRoles = (user.roles ?? '')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roles: parsedRoles.length > 0 ? parsedRoles : [user.role],
    avatarUrl: user.avatarUrl,
    locale: user.locale,
    createdAt: user.createdAt,
    birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null,
  };
}

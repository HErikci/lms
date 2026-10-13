import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../../lib/apiClient';
import type { AdminUser, AdminUserSummary, UserRole } from '../../../../types';

export interface UserFilters {
  q: string;
  role: UserRole | '';
  status: 'ACTIVE' | 'DISABLED' | '';
  page: number;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  roles: UserRole[];
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  roles?: UserRole[];
  password?: string;
  disabled?: boolean;
}

interface UserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  summary: AdminUserSummary;
}

export const PAGE_SIZE = 20;

/**
 * Kullanıcı yönetimi: GET /api/v1/admin/users (arama, rol/durum süzgeci, sayfalama).
 * Değişikliklerden sonra `reload` ile liste ve özet sayılar tazelenir.
 */
export function useAdminUsers(filters: UserFilters) {
  const [data, setData] = useState<UserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams({ page: String(filters.page), pageSize: String(PAGE_SIZE) });
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.role) params.set('role', filters.role);
  if (filters.status) params.set('status', filters.status);
  const query = params.toString();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return apiFetch<UserListResponse>(`/api/v1/admin/users?${query}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Kullanıcılar yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    users: data?.users ?? [],
    total: data?.total ?? 0,
    summary: data?.summary ?? null,
    loading,
    error,
    reload: load,
  };
}

export async function createUser(input: CreateUserInput): Promise<AdminUser> {
  const result = await apiFetch<{ user: AdminUser }>('/api/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return result.user;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<AdminUser> {
  const result = await apiFetch<{ user: AdminUser }>(`/api/v1/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return result.user;
}

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../../lib/apiClient';
import type { UserRole } from '../../../../types';

export interface AdminNavItem {
  id: string;
  path: string;
  label: string;
  icon: string;
  order: number;
  roles: UserRole[];
  createdAt: string;
  updatedAt: string;
}

export interface NavItemInput {
  path: string;
  label: string;
  icon: string;
  order: number;
  roles: UserRole[];
}

/**
 * Admin menü yönetimi: GET/POST/PATCH/DELETE /api/v1/admin/nav-items.
 * Sol menünün tüm rollere ait tam listesini (id, order, roles dahil) döner;
 * öğrenci/okutman menüsü useNavItems.ts (GET /api/v1/nav-items/me) ile
 * ayrı tutulur.
 */
export function useAdminNavItems() {
  const [items, setItems] = useState<AdminNavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return apiFetch<{ items: AdminNavItem[] }>('/api/v1/admin/nav-items')
      .then((result) => setItems(result.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Menü öğeleri yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createItem = useCallback(async (input: NavItemInput) => {
    const result = await apiFetch<{ item: AdminNavItem }>('/api/v1/admin/nav-items', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setItems((prev) => [...prev, result.item]);
    return result.item;
  }, []);

  const updateItem = useCallback(async (id: string, input: Partial<NavItemInput>) => {
    const result = await apiFetch<{ item: AdminNavItem }>(`/api/v1/admin/nav-items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    setItems((prev) => prev.map((item) => (item.id === id ? result.item : item)));
    return result.item;
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    await apiFetch<void>(`/api/v1/admin/nav-items/${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return { items, loading, error, reload: load, createItem, updateItem, deleteItem };
}

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import type { NavItem } from '../layout/Sidebar/navItems';
import type { UserRole } from '../types';

interface NavItemsResponse {
  items: NavItem[];
}

/**
 * Giriş yapmış kullanıcının rolüne göre filtrelenmiş/sıralanmış menü
 * öğelerini GET /api/v1/nav-items/me üzerinden yükler. Rol değiştiğinde
 * (örn. switchRole ile) yeniden yüklenir.
 */
export function useNavItems(role: UserRole | undefined) {
  const [items, setItems] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(undefined);

  useEffect(() => {
    if (!role) {
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(undefined);

    apiFetch<NavItemsResponse>('/api/v1/nav-items/me')
      .then((result) => {
        if (!cancelled) setItems(result.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [role]);

  return { items, loading, error };
}

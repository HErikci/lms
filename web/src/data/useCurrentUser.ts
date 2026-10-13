import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import type { UserProfile, UserRole } from '../types';

interface UserResponse {
  user: UserProfile;
}

interface SwitchRoleResponse {
  user: UserProfile;
  token: string;
}

/**
 * Giriş yapmış kullanıcının profilini GET /api/v1/auth/me üzerinden yükler.
 *
 * Sayfa yenilendiğinde (useAuth'un aksine) kullanıcıyı localStorage'daki
 * jetondan yeniden hidratlamak için kullanılır. Topbar ve profil ekranı gibi
 * birden fazla yer bu veriye ihtiyaç duyduğundan tekil kaynak burasıdır.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return apiFetch<UserResponse>('/api/v1/auth/me')
      .then((result) => setUser(result.user))
      .catch((err) => setError(err instanceof Error ? err.message : 'Kullanıcı yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Aktif rolü değiştirir. Sunucu yeni rolü yansıtan bir profil ve jeton
   * döner; jeton login/register ile aynı localStorage anahtarında saklanır
   * ve kullanıcı state'i güncellenerek tüm uygulama tam sayfa yenileme
   * olmadan yeni rolle yeniden render edilir. Hata durumunda çağıran
   * tarafın yakalayabilmesi için exception fırlatılır.
   */
  const switchRole = useCallback(async (role: UserRole) => {
    const result = await apiFetch<SwitchRoleResponse>('/api/v1/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    localStorage.setItem('authToken', result.token);
    setUser(result.user);
  }, []);

  return { user, setUser, loading, error, reload: load, switchRole };
}

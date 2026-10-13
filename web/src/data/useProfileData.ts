import { useCallback, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useCurrentUser } from './useCurrentUser';
import type { UserProfile } from '../types';

interface UserResponse {
  user: UserProfile;
}

export interface ProfileUpdateInput {
  name?: string;
  avatarUrl?: string | null;
  locale?: string;
}

/**
 * Profil verisinin tek giriş noktası.
 *
 * Kullanıcıyı yüklemek için useCurrentUser'ı kullanır (GET /api/v1/auth/me),
 * güncelleme için PATCH /api/v1/users/me ekler. apiFetch zaten
 * localStorage('authToken') içindeki jetonu Authorization: Bearer başlığına
 * ekliyor.
 */
export function useProfileData() {
  const { user: profile, setUser: setProfile, loading, error: loadError, reload } = useCurrentUser();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateProfile = useCallback(
    async (input: ProfileUpdateInput) => {
      setSaving(true);
      setSaveError(null);
      try {
        const result = await apiFetch<UserResponse>('/api/v1/users/me', {
          method: 'PATCH',
          body: JSON.stringify(input),
        });
        setProfile(result.user);
        return result.user;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Profil güncellenemedi.';
        setSaveError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [setProfile],
  );

  return { profile, loading, error: saveError ?? loadError, saving, updateProfile, reload };
}

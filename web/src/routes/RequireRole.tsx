import { Navigate, Outlet } from 'react-router-dom';
import { useCurrentUser } from '../data/useCurrentUser';
import type { UserRole } from '../types';

interface RequireRoleProps {
  allow: UserRole[];
}

/**
 * Belirli rollere sahip kullanıcılar dışındakileri anasayfaya yönlendirir.
 * Kullanıcı verisi yüklenirken (loading === true) henüz karar vermez; aksi
 * halde rol bilgisi gelmeden yanlış içerik/yönlendirme "flash" edebilir.
 */
export function RequireRole({ allow }: RequireRoleProps) {
  const { user, loading } = useCurrentUser();

  if (loading && !user) {
    return null;
  }

  if (!user || !allow.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

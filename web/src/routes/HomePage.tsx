import { Navigate, useOutletContext } from 'react-router-dom';
import { DashboardPage } from '../features/dashboard';
import type { UserProfile } from '../types';

export function HomePage() {
  const { user, loading, error } = useOutletContext<{ user: UserProfile | null; loading: boolean; error: string | null }>();
  if (loading && !user) return <p role="status">Panel yükleniyor…</p>;
  if (error && !user) return <p role="alert">{error}</p>;
  return user?.role === 'GUARDIAN' ? <Navigate to="/veli" replace /> : <DashboardPage />;
}

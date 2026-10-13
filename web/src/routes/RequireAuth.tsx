import { Navigate, Outlet } from 'react-router-dom';

/**
 * AppShell altindaki tum sayfalari korur. localStorage'da gecerli bir
 * authToken yoksa /giris'e yonlendirir. Token varligi kontrolu yeterlidir;
 * token gecersizse (401) apiClient'teki interceptor zaten /giris'e atar.
 */
export function RequireAuth() {
  const token = localStorage.getItem('authToken');

  if (!token) {
    return <Navigate to="/giris" replace />;
  }

  return <Outlet />;
}

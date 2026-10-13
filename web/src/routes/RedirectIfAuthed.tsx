import { Navigate, Outlet } from 'react-router-dom';

/**
 * /giris sayfasini sarar: zaten gecerli bir authToken varsa kullaniciyi
 * dogrudan anasayfaya yonlendirir.
 */
export function RedirectIfAuthed() {
  const token = localStorage.getItem('authToken');

  if (token) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

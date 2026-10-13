import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../Sidebar';
import { Topbar } from '../Topbar';
import { useCurrentUser } from '../../data/useCurrentUser';
import styles from './AppShell.module.css';

/** Sidebar + Topbar kabuğu; sayfalar <Outlet /> içine render edilir. */
export function AppShell() {
  const { user, switchRole } = useCurrentUser();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Rota değiştiğinde mobil çekmece kapanır.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className={styles.shell}>
      <a href="#main-content" className="skip-link">
        İçeriğe geç
      </a>

      <Sidebar user={user} isOpen={isMenuOpen} onNavigate={() => setMenuOpen(false)} />

      {isMenuOpen ? (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Menüyü kapat"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className={styles.body}>
        <Topbar
          user={user}
          switchRole={switchRole}
          isMenuOpen={isMenuOpen}
          onMenuToggle={() => setMenuOpen((open) => !open)}
        />
        <main id="main-content" className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

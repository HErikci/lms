import { NavLink } from 'react-router-dom';
import { Icon, Text } from '../../components';
import { useCurrentUser } from '../../data/useCurrentUser';
import { getNavItems } from './navItems';
import styles from './Sidebar.module.css';

interface SidebarProps {
  /** Mobil çekmecenin açık olup olmadığı. Masaüstünde yok sayılır. */
  isOpen: boolean;
  onNavigate: () => void;
}

export function Sidebar({ isOpen, onNavigate }: SidebarProps) {
  const { user } = useCurrentUser();
  const navItems = getNavItems(user?.role);

  return (
    <aside
      className={[styles.sidebar, isOpen ? styles.open : null].filter(Boolean).join(' ')}
      aria-label="Ana gezinme"
    >
      <div>
        <div className={styles.brand}>
          <img src="/logo.png" alt="" className={styles.logo} />
          <span className={styles.brandText}>
            <Text role="title-md" tone="primary">
              Akademi LMS
            </Text>
            <Text role="label-md" tone="secondary">
              Öğrenci Portalı
            </Text>
          </span>
        </div>

        <p className={[styles.sectionLabel, 'label-md'].join(' ')}>Menü</p>

        <nav className={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                [styles.navItem, isActive ? styles.navItemActive : null]
                  .filter(Boolean)
                  .join(' ')
              }
            >
              <Icon name={item.icon} size="lg" />
              <span className={styles.navLabel}>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className={styles.assistantCard}>
        <Icon name="auto_awesome" size="md" className={styles.assistantIcon} />
        <span className={styles.assistantText}>
          <Text role="label-lg" tone="main">
            Akıllı Asistan
          </Text>
          <Text role="body-sm" tone="muted">
            Ders özetleri ve sınav hazırlığı aktif
          </Text>
        </span>
      </div>
    </aside>
  );
}

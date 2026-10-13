import type { UserRole } from '../../types';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const BASE_NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Genel Bakış', icon: 'grid_view' },
  { path: '/kurslarim', label: 'Kurslarım / Dersler', icon: 'school' },
  { path: '/duyurular', label: 'Duyurular', icon: 'campaign' },
  { path: '/takvim', label: 'Takvim', icon: 'calendar_today' },
  { path: '/notlar-ve-gorevler', label: 'Notlar & Görevler', icon: 'assignment_turned_in' },
  { path: '/sinavlar', label: 'Sınav Sistemi', icon: 'quiz' },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { path: '/yonetim/kurslar', label: 'Kurs Yönetimi', icon: 'admin_panel_settings' },
];

/**
 * Sol menünün tek kaynağı. Yeni bir sayfa eklemek için buraya bir satır,
 * routes/index.tsx içine bir <Route> eklemek yeterli.
 * Yollar ui/code.html'deki data-path değerleriyle aynı.
 * Aktif role göre ek (örn. admin) öğeler burada eklenir; Sidebar.tsx
 * sadece bu listeyi render eder, rol bazlı dallanma yapmaz.
 */
export function getNavItems(role: UserRole | undefined): NavItem[] {
  if (role === 'ADMIN') {
    return [...BASE_NAV_ITEMS, ...ADMIN_NAV_ITEMS];
  }
  return BASE_NAV_ITEMS;
}

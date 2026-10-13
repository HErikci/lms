export interface NavItem {
  path: string;
  label: string;
  icon: string;
}

/**
 * Sol menünün tek kaynağı. Yeni bir sayfa eklemek için buraya bir satır,
 * routes/index.tsx içine bir <Route> eklemek yeterli.
 * Yollar ui/code.html'deki data-path değerleriyle aynı.
 */
export const navItems: NavItem[] = [
  { path: '/', label: 'Genel Bakış', icon: 'grid_view' },
  { path: '/kurslarim', label: 'Kurslarım / Dersler', icon: 'school' },
  { path: '/duyurular', label: 'Duyurular', icon: 'campaign' },
  { path: '/takvim', label: 'Takvim', icon: 'calendar_today' },
  { path: '/notlar-ve-gorevler', label: 'Notlar & Görevler', icon: 'assignment_turned_in' },
  { path: '/sinavlar', label: 'Sınav Sistemi', icon: 'quiz' },
];

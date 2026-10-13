export interface NavItem {
  path: string;
  label: string;
  icon: string;
}

/**
 * Menü artık DB üzerinden (GET /api/v1/nav-items/me, bkz. useNavItems.ts)
 * yüklenir. Bu liste yalnızca yükleme sırasında / istek hata verdiğinde
 * gösterilecek bir yedek (fallback): öğrencilerin de erişebildiği 5 ortak
 * sayfa. Admin'e özel "Menü Yönetimi" bağlantısı Sidebar.tsx içinde
 * role === 'ADMIN' olduğunda istemci tarafında eklenir (bkz. Sidebar.tsx),
 * tıpkı daha önce "Kurs Yönetimi" girişinin eklendiği gibi.
 */
export const FALLBACK_NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Genel Bakış', icon: 'grid_view' },
  { path: '/kurslarim', label: 'Kurslarım / Dersler', icon: 'school' },
  { path: '/duyurular', label: 'Duyurular', icon: 'campaign' },
  { path: '/takvim', label: 'Takvim', icon: 'calendar_today' },
  { path: '/notlar-ve-gorevler', label: 'Notlar & Görevler', icon: 'assignment_turned_in' },
  { path: '/sinavlar', label: 'Sınav Sistemi', icon: 'quiz' },
];

export const ADMIN_MENU_MANAGEMENT_ITEM: NavItem = {
  path: '/yonetim/menu',
  label: 'Menü Yönetimi',
  icon: 'list_alt',
};

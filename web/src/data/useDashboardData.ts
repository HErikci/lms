import type { DashboardData } from '../types';
import { dashboardFixture } from './dashboard.fixtures';

/**
 * Dashboard verisinin tek giriş noktası.
 *
 * BACKEND GEÇİŞ NOKTASI: Node/SQLite API hazır olduğunda yalnızca bu fonksiyonun
 * gövdesi değişir (ör. fetch + yükleniyor/hata durumu). Dönüş tipi aynı kaldığı
 * sürece hiçbir bileşene dokunulması gerekmez.
 */
export function useDashboardData(): DashboardData {
  return dashboardFixture;
}

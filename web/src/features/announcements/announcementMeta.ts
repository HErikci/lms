import type { BadgeTone } from '../../components';
import type { AnnouncementCategory, AnnouncementItem, AnnouncementState } from '../../types';

/** Simge kutusu renkleri (AnnouncementsPage.module.css `.icon-*` sınıfları). */
export type CategoryIconTone = 'secondary' | 'cyan' | 'warning' | 'muted' | 'success';

interface CategoryMeta {
  label: string;
  icon: string;
  badgeTone: BadgeTone;
  iconTone: CategoryIconTone;
}

export const CATEGORIES: Record<AnnouncementCategory, CategoryMeta> = {
  ACADEMIC: { label: 'Akademik', icon: 'school', badgeTone: 'secondary', iconTone: 'secondary' },
  COURSE: { label: 'Ders', icon: 'menu_book', badgeTone: 'cyan', iconTone: 'cyan' },
  IT: { label: 'Bilgi İşlem', icon: 'dns', badgeTone: 'muted', iconTone: 'muted' },
  EVENT: { label: 'Etkinlik', icon: 'celebration', badgeTone: 'success', iconTone: 'success' },
  GENERAL: { label: 'Genel', icon: 'campaign', badgeTone: 'warning', iconTone: 'warning' },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as AnnouncementCategory[];

export const STATES: Record<AnnouncementState, { label: string; tone: BadgeTone; icon: string }> = {
  DRAFT: { label: 'Taslak', tone: 'neutral', icon: 'edit_note' },
  SCHEDULED: { label: 'Zamanlandı', tone: 'info', icon: 'schedule' },
  PUBLISHED: { label: 'Yayında', tone: 'success', icon: 'check_circle' },
  EXPIRED: { label: 'Süresi doldu', tone: 'warning', icon: 'history' },
};

export const STATE_KEYS = Object.keys(STATES) as AnnouncementState[];

const relativeFormat = new Intl.RelativeTimeFormat('tr', { numeric: 'auto' });
const dateTimeFormat = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short' });

/** "3 saat önce", "dün", "2 gün sonra"; bir haftadan uzaksa tam tarih. */
export function formatRelative(iso: string, now = Date.now()): string {
  const diffSeconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return 'az önce';
  if (abs < 3600) return relativeFormat.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 86400) return relativeFormat.format(Math.round(diffSeconds / 3600), 'hour');
  if (abs < 7 * 86400) return relativeFormat.format(Math.round(diffSeconds / 86400), 'day');
  return formatDateTime(iso);
}

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

/** Kaynak satırı: kurs duyurusunda kurs adı, genelde yazar. */
export function sourceLabel(announcement: AnnouncementItem): string {
  return announcement.course?.title ?? announcement.author?.name ?? 'BTK Akademi';
}

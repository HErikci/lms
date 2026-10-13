import type { BadgeTone } from '../../components';
import type { ExamAvailability, ExamStatus, ExamType } from '../../types';

export const EXAM_TYPES: Record<ExamType, { label: string; icon: string }> = {
  QUIZ: { label: 'Kısa Sınav', icon: 'quiz' },
  MIDTERM: { label: 'Ara Sınav', icon: 'assignment' },
  FINAL: { label: 'Final', icon: 'school' },
  PRACTICE: { label: 'Deneme Sınavı', icon: 'psychology' },
};

export const EXAM_TYPE_KEYS = Object.keys(EXAM_TYPES) as ExamType[];

export const AVAILABILITY: Record<ExamAvailability, { label: string; tone: BadgeTone; icon: string }> = {
  OPEN: { label: 'Şu an açık', tone: 'success', icon: 'play_circle' },
  UPCOMING: { label: 'Yaklaşıyor', tone: 'warning', icon: 'event_upcoming' },
  CLOSED: { label: 'Sona erdi', tone: 'neutral', icon: 'event_busy' },
};

export const EXAM_STATUS: Record<ExamStatus, { label: string; tone: BadgeTone; icon: string }> = {
  DRAFT: { label: 'Taslak', tone: 'neutral', icon: 'edit_note' },
  PUBLISHED: { label: 'Yayında', tone: 'success', icon: 'check_circle' },
};

const dateTimeFormat = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

/** Sınav penceresi; Türkçe ek uyumu gerektirmeyen biçimde. */
export function formatWindow(startsAt: string | null, endsAt: string | null): string {
  if (startsAt && endsAt) return `${formatDateTime(startsAt)} – ${formatDateTime(endsAt)}`;
  if (startsAt) return `Başlangıç: ${formatDateTime(startsAt)}`;
  if (endsAt) return `Son: ${formatDateTime(endsAt)}`;
  return 'Zaman sınırı yok';
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'Süre sınırı yok';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} dakika`;
  return rest === 0 ? `${hours} saat` : `${hours} saat ${rest} dakika`;
}

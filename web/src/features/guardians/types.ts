import type { CourseProgress } from '../../types';

export type NotificationChannel = 'EMAIL' | 'SMS';
export interface GuardianLink {
  id: string;
  phone: string | null;
  emailEnabled: boolean;
  smsEnabled: boolean;
}
export interface NotificationResult {
  id: string;
  channel: NotificationChannel;
  status: 'PENDING' | 'SENT' | 'FAILED';
  error: string | null;
  createdAt: string;
  sentAt: string | null;
}
export interface GuardianNotification extends NotificationResult {
  student: { id: string; name: string };
}
export interface GuardianChild {
  link: GuardianLink;
  report: {
    student: { id: string; name: string; birthDate: string | null };
    courses: { id: string; title: string; progress: CourseProgress }[];
    grades: { lessonTitle: string; courseTitle: string; score: number; gradedAt: string }[];
    exams: { title: string; courseTitle: string; score: number | null; status: string; submittedAt: string | null }[];
    studySeconds: number;
    generatedAt: string;
  };
}
export interface AdminGuardianLink extends GuardianLink {
  student: { id: string; name: string; email: string; birthDate: string | null };
  guardian: { id: string; name: string; email: string };
  createdAt: string;
}
export interface GuardianOptions {
  students: { id: string; name: string; email: string; birthDate: string | null; isMinor: boolean }[];
  guardians: { id: string; name: string; email: string }[];
}

export const notificationStatus = { PENDING: 'Bekliyor', SENT: 'Sağlayıcı kabul etti', FAILED: 'Başarısız' };
export function notificationMessage(notification: NotificationResult) {
  if (notification.status === 'FAILED') return notification.error || 'Rapor gönderilemedi.';
  return notification.status === 'SENT' ? 'Rapor gönderimini sağlayıcı kabul etti.' : 'Rapor gönderim için sıraya alındı.';
}
export function formatDate(value: string | null, includeTime = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', ...(includeTime ? { timeStyle: 'short' as const } : {}), timeZone: 'Europe/Istanbul' }).format(new Date(value));
}

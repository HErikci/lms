import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/apiClient';
import type { ActivityDay, StudyActivityReport } from '../../types';

/** Pazar = 0 sırasıyla kısa gün adları. */
const WEEKDAY_LABELS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

const toMinutes = (seconds: number) => Math.round(seconds / 60);

function toActivityDays(report: StudyActivityReport): ActivityDay[] {
  return report.days.map((day) => {
    const isToday = day.date === report.today;
    // Tarih yalnızca gün adı için okunur; saat dilimi kaymasını önlemek için UTC kullanılır.
    const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay();
    return {
      date: day.date,
      label: isToday ? 'Bugün' : WEEKDAY_LABELS[weekday],
      videoMinutes: toMinutes(day.videoSeconds),
      otherMinutes: toMinutes(day.quizSeconds + day.readingSeconds),
      isToday,
    };
  });
}

/** Dashboard çalışma aktivitesi: son 7 gün, toplamlar ve gün serisi. */
export function useStudyActivity() {
  const [report, setReport] = useState<StudyActivityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<StudyActivityReport>('/api/v1/users/me/activity?days=7')
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : 'Çalışma aktivitesi yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  return {
    loading,
    error,
    activity: report ? toActivityDays(report) : [],
    todayMinutes: report ? toMinutes(report.totals.todaySeconds) : null,
    weekHours: report ? report.totals.rangeSeconds / 3600 : null,
    monthHours: report ? report.totals.monthSeconds / 3600 : null,
    streakDays: report?.streakDays ?? null,
  };
}

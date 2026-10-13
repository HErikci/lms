import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/apiClient';
import type { CourseSummary } from '../../types';

/** Yayınlanmış tüm kurslar (kayıt durumundan bağımsız): GET /api/v1/courses */
export function useAllCourses() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ courses: CourseSummary[] }>('/api/v1/courses')
      .then((result) => setCourses(result.courses))
      .catch((err) => setError(err instanceof Error ? err.message : 'Kurslar yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  return { courses, loading, error };
}

import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/apiClient';
import type { CourseSummary } from '../../types';

export type EnrolledCourseSummary = CourseSummary;

/** Öğrencinin kayıtlı olduğu kurslar: GET /api/v1/users/me/courses */
export function useCourses() {
  const [courses, setCourses] = useState<EnrolledCourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ courses: EnrolledCourseSummary[] }>('/api/v1/users/me/courses')
      .then((result) => setCourses(result.courses))
      .catch((err) => setError(err instanceof Error ? err.message : 'Kurslar yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  return { courses, loading, error };
}

import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/apiClient';

export interface EnrolledCourseSummary {
  id: string;
  title: string;
  category: string;
  level: string;
  accessMode: 'SEQUENTIAL' | 'FREE';
}

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

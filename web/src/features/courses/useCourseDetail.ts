import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/apiClient';
import { enrollInCourse } from './enrollInCourse';
import type { CourseDetail } from '../../types';

/** Tek bir kursun detayı: GET /api/v1/courses/:id */
export function useCourseDetail(courseId: string | undefined) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const load = useCallback(() => {
    if (!courseId) {
      return;
    }
    setLoading(true);
    setError(null);
    apiFetch<{ course: CourseDetail }>(`/api/v1/courses/${courseId}`)
      .then((result) => setCourse(result.course))
      .catch((err) => setError(err instanceof Error ? err.message : 'Kurs yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const enroll = useCallback(async () => {
    if (!courseId) {
      return;
    }
    setEnrolling(true);
    try {
      await enrollInCourse(courseId);
      // İçerik kilidini açmak için kursu yeniden getir (modules artık dolu gelir).
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt işlemi başarısız oldu.');
    } finally {
      setEnrolling(false);
    }
  }, [courseId, load]);

  return { course, loading, error, enrolling, enroll };
}

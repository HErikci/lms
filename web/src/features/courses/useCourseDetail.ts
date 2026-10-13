import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/apiClient';
import { enrollInCourse } from './enrollInCourse';
import type { CourseDetail, CourseProgressDetail } from '../../types';

/** Tek bir kursun detayı: GET /api/v1/courses/:id */
export function useCourseDetail(courseId: string | undefined) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [pendingLessonId, setPendingLessonId] = useState<string | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);

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

  const setLessonCompleted = useCallback(
    async (lessonId: string, done: boolean) => {
      if (!courseId || !course) {
        return;
      }
      const previous = course.progress;
      const totalLessons =
        previous?.totalLessons ?? course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
      const ids = new Set(previous?.completedLessonIds ?? []);
      if (done) {
        ids.add(lessonId);
      } else {
        ids.delete(lessonId);
      }
      const optimistic: CourseProgressDetail = {
        courseId,
        completedLessonIds: Array.from(ids),
        completedCount: ids.size,
        totalLessons,
        percent: totalLessons > 0 ? Math.round((ids.size / totalLessons) * 100) : 0,
      };
      setProgressError(null);
      setPendingLessonId(lessonId);
      setCourse((current) => (current ? { ...current, progress: optimistic } : current));
      try {
        const result = await apiFetch<{ progress: CourseProgressDetail }>(
          `/api/v1/lessons/${lessonId}/completion`,
          { method: done ? 'PUT' : 'DELETE' },
        );
        setCourse((current) => (current ? { ...current, progress: result.progress } : current));
      } catch (err) {
        setCourse((current) => (current ? { ...current, progress: previous } : current));
        setProgressError(
          err instanceof Error ? err.message : 'Tamamlanma durumu güncellenemedi.',
        );
      } finally {
        setPendingLessonId(null);
      }
    },
    [courseId, course],
  );

  return {
    course,
    loading,
    error,
    enrolling,
    enroll,
    setLessonCompleted,
    pendingLessonId,
    progressError,
  };
}

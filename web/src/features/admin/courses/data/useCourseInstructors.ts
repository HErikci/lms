import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../../lib/apiClient';
import type { CourseInstructor } from '../../../../types';

export interface AssignableInstructor {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

/**
 * Atanabilir eğitmen havuzu: GET /api/v1/instructors (yalnızca ADMIN).
 */
export function useAssignableInstructors() {
  const [pool, setPool] = useState<AssignableInstructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<{ instructors: AssignableInstructor[] }>('/api/v1/instructors')
      .then((result) => {
        if (active) setPool(result.instructors);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Eğitmenler yüklenemedi.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { pool, loading, error };
}

/**
 * Bir kursun eğitmen listesi ve atama/kaldırma/sıralama işlemleri.
 * Her değişiklik yanıtındaki `instructors` ile state güncellenir.
 */
export function useCourseInstructors(courseId: string | undefined) {
  const [instructors, setInstructors] = useState<CourseInstructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pool, error: poolError } = useAssignableInstructors();

  const load = useCallback(() => {
    if (!courseId) {
      return Promise.resolve();
    }
    setLoading(true);
    setError(null);
    return apiFetch<{ instructors: CourseInstructor[] }>(`/api/v1/courses/${courseId}/instructors`)
      .then((result) => setInstructors(result.instructors))
      .catch((err) => setError(err instanceof Error ? err.message : 'Eğitmenler yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const addInstructor = useCallback(
    async (userId: string) => {
      if (!courseId) return;
      const result = await apiFetch<{ instructors: CourseInstructor[] }>(
        `/api/v1/courses/${courseId}/instructors`,
        { method: 'POST', body: JSON.stringify({ userId }) },
      );
      setInstructors(result.instructors);
    },
    [courseId],
  );

  const removeInstructor = useCallback(
    async (userId: string) => {
      if (!courseId) return;
      const result = await apiFetch<{ instructors: CourseInstructor[] }>(
        `/api/v1/courses/${courseId}/instructors/${userId}`,
        { method: 'DELETE' },
      );
      setInstructors(result.instructors);
    },
    [courseId],
  );

  const reorderInstructors = useCallback(
    async (userIds: string[]) => {
      if (!courseId) return;
      const result = await apiFetch<{ instructors: CourseInstructor[] }>(
        `/api/v1/courses/${courseId}/instructors/order`,
        { method: 'PUT', body: JSON.stringify({ userIds }) },
      );
      setInstructors(result.instructors);
    },
    [courseId],
  );

  const assignedIds = new Set(instructors.map((instructor) => instructor.id));
  const available = pool.filter((candidate) => !assignedIds.has(candidate.id));

  return {
    instructors,
    available,
    loading,
    error: error ?? poolError,
    reload: load,
    addInstructor,
    removeInstructor,
    reorderInstructors,
  };
}

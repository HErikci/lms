import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/apiClient';
import type { UserProfile } from '../../types';
import type { CourseOption } from './EventFormDialog';

interface CourseListItem {
  id: string;
  title: string;
  instructors?: { id: string }[];
}

/**
 * Etkinlik formundaki kurs seçici için kurslar. ADMIN tümünü görür; INSTRUCTOR için
 * GET /api/v1/courses listesi istemci tarafında kendi atandığı kurslara süzülür.
 */
export function useEventCourses(user: UserProfile | null): CourseOption[] {
  const [courses, setCourses] = useState<CourseOption[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiFetch<{ courses: CourseListItem[] }>('/api/v1/courses')
      .then((result) => {
        if (cancelled) return;
        const list =
          user.role === 'ADMIN'
            ? result.courses
            : result.courses.filter((course) => course.instructors?.some((i) => i.id === user.id));
        setCourses(list.map((course) => ({ id: course.id, title: course.title })));
      })
      .catch(() => {
        if (!cancelled) setCourses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return courses;
}

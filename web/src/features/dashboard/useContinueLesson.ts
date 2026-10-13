import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/apiClient';
import { useCourses } from '../courses/useCourses';
import type { CourseDetail, CourseLessonSummary, CourseModuleSummary, CourseSummary } from '../../types';

export interface ContinueLessonData {
  courseId: string;
  courseTitle: string;
  lesson: CourseLessonSummary;
  moduleTitle: string;
  /** Kurs içindeki sıra numarası (1 tabanlı) ve toplam yayınlı ders sayısı. */
  lessonNumber: number;
  totalLessons: number;
  /** Dersin ait olduğu modüldeki tamamlanma yüzdesi. */
  moduleProgress: number;
  /** Kullanıcı bu kursta henüz hiçbir ders tamamlamadıysa true. */
  notStarted: boolean;
}

/** Tamamlanmamış kurslar arasında en ilerideki; hiçbirinde ilerleme yoksa ilki. */
function pickCourse(courses: CourseSummary[]): CourseSummary | null {
  const open = courses.filter((course) => (course.progress?.percent ?? 0) < 100);
  if (open.length === 0) return null;
  return open.reduce((best, course) =>
    (course.progress?.percent ?? 0) > (best.progress?.percent ?? 0) ? course : best,
  );
}

function resolveNextLesson(course: CourseDetail): ContinueLessonData | null {
  const completed = new Set(course.progress?.completedLessonIds ?? []);
  const modules: CourseModuleSummary[] = course.modules
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((module) => ({
      ...module,
      lessons: module.lessons
        .filter((lesson) => lesson.status === 'PUBLISHED')
        .sort((a, b) => a.order - b.order),
    }));
  const flat = modules.flatMap((module) => module.lessons.map((lesson) => ({ lesson, module })));
  const index = flat.findIndex(({ lesson }) => !completed.has(lesson.id));
  if (index === -1) return null;

  const { lesson, module } = flat[index];
  const moduleDone = module.lessons.filter((item) => completed.has(item.id)).length;
  return {
    courseId: course.id,
    courseTitle: course.title,
    lesson,
    moduleTitle: module.title,
    lessonNumber: index + 1,
    totalLessons: flat.length,
    moduleProgress: Math.round((100 * moduleDone) / module.lessons.length),
    notStarted: completed.size === 0,
  };
}

/** Dashboard "Kaldığın Yerden Devam Et" kartı: kullanıcının sıradaki dersi. */
export function useContinueLesson() {
  const { courses, loading: coursesLoading, error: coursesError } = useCourses();
  const [data, setData] = useState<ContinueLessonData | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (coursesLoading) return;
    const picked = pickCourse(courses);
    if (!picked) {
      setData(null);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    apiFetch<{ course: CourseDetail }>(`/api/v1/courses/${picked.id}`)
      .then((result) => !cancelled && setData(resolveNextLesson(result.course)))
      .catch((err) => !cancelled && setDetailError(err instanceof Error ? err.message : 'Ders yüklenemedi.'))
      .finally(() => !cancelled && setDetailLoading(false));
    return () => {
      cancelled = true;
    };
  }, [courses, coursesLoading]);

  return {
    data,
    loading: coursesLoading || detailLoading,
    error: coursesError ?? detailError,
    hasCourses: courses.length > 0,
  };
}

import { useMyGrades } from '../dashboard/useMyGrades';

/**
 * Öğrencinin tek bir dersteki (quiz) notu. Ayrı bir uç nokta olmadığından
 * GET /api/v1/users/me/grades listesinden lessonId ile bulunur.
 */
export function useMyLessonGrade(lessonId: string | undefined) {
  const { loading, error, grades } = useMyGrades();
  const grade = lessonId ? (grades.find((item) => item.lessonId === lessonId) ?? null) : null;
  return { grade, loading, error };
}

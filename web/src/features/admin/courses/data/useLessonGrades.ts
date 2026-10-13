import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../../../../lib/apiClient';

export interface GradeStudent {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

/** Kursa kayıtlı bir öğrenci ve bu derste (quiz) aldığı not; not girilmediyse score null. */
export interface LessonGradeRow {
  student: GradeStudent;
  score: number | null;
  gradedAt: string | null;
}

export interface GradedLesson {
  id: string;
  title: string;
  courseId: string;
}

interface LessonGradesResponse {
  lesson: GradedLesson;
  grades: LessonGradeRow[];
}

interface SaveGradeResponse {
  grade: { userId: string; lessonId: string; score: number; gradedAt: string };
}

/** Sunucu hata kodu → Türkçe kullanıcı mesajı. Bilinmeyen kodlarda sunucu mesajı kullanılır. */
const GRADE_ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Not 0 ile 100 arasında bir tam sayı olmalıdır.',
  NOT_A_QUIZ: 'Yalnızca sınav (quiz) dersleri notlandırılabilir.',
  STUDENT_NOT_ENROLLED: 'Öğrenci bu kursa kayıtlı değil.',
  FORBIDDEN: 'Bu dersin notlarını yönetme yetkiniz yok.',
  NOT_FOUND: 'Ders veya öğrenci bulunamadı.',
};

export function isForbiddenError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 403 || err.code === 'FORBIDDEN');
}

export function describeGradeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return GRADE_ERROR_MESSAGES[err.code] ?? err.message;
  }
  return fallback;
}

/**
 * Bir quiz dersinin not defteri: GET /api/v1/lessons/:lessonId/grades (ADMIN veya kursa atanmış
 * INSTRUCTOR). Not girme ve silme işlemleri ilgili satırı yanıta göre günceller; hatalar çağıran
 * tarafa fırlatılır ki her satır kendi hata mesajını gösterebilsin.
 */
export function useLessonGrades(lessonId: string | undefined) {
  const [lesson, setLesson] = useState<GradedLesson | null>(null);
  const [rows, setRows] = useState<LessonGradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!lessonId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    setForbidden(false);
    setLesson(null);
    setRows([]);
    apiFetch<LessonGradesResponse>(`/api/v1/lessons/${lessonId}/grades`)
      .then((result) => {
        if (!active) return;
        setLesson(result.lesson);
        setRows(result.grades);
      })
      .catch((err) => {
        if (!active) return;
        setForbidden(isForbiddenError(err));
        setError(describeGradeError(err, 'Notlar yüklenemedi.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [lessonId]);

  const saveGrade = useCallback(
    async (userId: string, score: number) => {
      if (!lessonId) return;
      const result = await apiFetch<SaveGradeResponse>(`/api/v1/lessons/${lessonId}/grades/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ score }),
      });
      setRows((prev) =>
        prev.map((row) =>
          row.student.id === userId
            ? { ...row, score: result.grade.score, gradedAt: result.grade.gradedAt }
            : row,
        ),
      );
    },
    [lessonId],
  );

  const deleteGrade = useCallback(
    async (userId: string) => {
      if (!lessonId) return;
      await apiFetch<{ deleted: boolean }>(`/api/v1/lessons/${lessonId}/grades/${userId}`, {
        method: 'DELETE',
      });
      setRows((prev) =>
        prev.map((row) => (row.student.id === userId ? { ...row, score: null, gradedAt: null } : row)),
      );
    },
    [lessonId],
  );

  return { lesson, rows, loading, error, forbidden, saveGrade, deleteGrade };
}

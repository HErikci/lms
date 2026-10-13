import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/apiClient';
import type { GradeSummary, MyGrade, MyGradesReport } from '../../types';

/** Öğrencinin quiz notları ve özeti: GET /api/v1/users/me/grades */
export function useMyGrades() {
  const [report, setReport] = useState<MyGradesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<MyGradesReport>('/api/v1/users/me/grades')
      .then((result) => {
        if (active) setReport(result);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Notlar yüklenemedi.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const summary: GradeSummary | null = report?.summary ?? null;
  const grades: MyGrade[] = report?.grades ?? [];

  return { loading, error, summary, grades };
}

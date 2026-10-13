import { useApiResource } from '../../lib/useApiResource';
import type { MyExam } from '../../types';

/** GET /api/v1/exams/my: öğrencinin girebileceği yayındaki sınavlar (sorular gelmez). */
export function useMyExams() {
  const { data, loading, error } = useApiResource<{ exams: MyExam[]; serverTime: string }>('/api/v1/exams/my');
  return { exams: data?.exams ?? [], loading, error };
}

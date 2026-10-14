import { apiFetch } from '../../../../lib/apiClient';
import { useApiResource } from '../../../../lib/useApiResource';
import type { ExamAudience, ExamCandidate, ExamDetail, ExamSettings, ExamType, ManagedExam } from '../../../../types';

export interface CandidateList {
  audience: ExamAudience;
  students: ExamCandidate[];
}

export interface NewExamInput {
  courseId: string;
  title: string;
  type: ExamType;
  description: string | null;
  learningObjectives: string[];
  requiresCourseCompletion: boolean;
}

/** GET /api/v1/exams/manage: kullanıcının yönetebildiği sınavlar. */
export function useManagedExams() {
  const { data, loading, error, reload } = useApiResource<{ exams: ManagedExam[] }>('/api/v1/exams/manage');
  return { exams: data?.exams ?? [], loading, error, reload };
}

/** Sınav ayrıntısı; değişiklik çağrıları güncel ayrıntıyı döndürür, `setDetail` ile yerine konur. */
export function useExamDetail(examId: string | undefined) {
  const { data, setData, loading, error, reload } = useApiResource<ExamDetail>(
    examId ? `/api/v1/exams/${examId}` : null,
  );
  return { detail: data, setDetail: setData, loading, error, reload };
}

export function useExamCandidates(examId: string | undefined) {
  const { data, setData, loading, error, reload } = useApiResource<CandidateList>(
    examId ? `/api/v1/exams/${examId}/candidates` : null,
  );
  return { candidates: data, setCandidates: setData, loading, error, reload };
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export function createExam(input: NewExamInput): Promise<ExamDetail> {
  return apiFetch<ExamDetail>('/api/v1/exams', json('POST', input));
}

export function updateExam(id: string, patch: Partial<ExamSettings>): Promise<ExamDetail> {
  return apiFetch<ExamDetail>(`/api/v1/exams/${id}`, json('PATCH', patch));
}

export async function deleteExam(id: string): Promise<void> {
  await apiFetch(`/api/v1/exams/${id}`, json('DELETE'));
}

export function addExamQuestions(id: string, questionIds: string[]): Promise<ExamDetail> {
  return apiFetch<ExamDetail>(`/api/v1/exams/${id}/questions`, json('POST', { questionIds }));
}

export function updateExamQuestionPoints(id: string, questionId: string, points: number): Promise<ExamDetail> {
  return apiFetch<ExamDetail>(`/api/v1/exams/${id}/questions/${questionId}`, json('PATCH', { points }));
}

export function removeExamQuestion(id: string, questionId: string): Promise<ExamDetail> {
  return apiFetch<ExamDetail>(`/api/v1/exams/${id}/questions/${questionId}`, json('DELETE'));
}

export function reorderExamQuestions(id: string, questionIds: string[]): Promise<ExamDetail> {
  return apiFetch<ExamDetail>(`/api/v1/exams/${id}/questions/order`, json('PUT', { questionIds }));
}

export function saveExamCandidates(id: string, userIds: string[]): Promise<CandidateList> {
  return apiFetch<CandidateList>(`/api/v1/exams/${id}/candidates`, json('PUT', { userIds }));
}

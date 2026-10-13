import { apiFetch } from '../../../../lib/apiClient';
import { useApiResource } from '../../../../lib/useApiResource';
import type { BankQuestion, QuestionBank, QuestionDifficulty, TypedQuestionContent } from '../../../../types';

export interface BankInput {
  name: string;
  description: string | null;
  /** Yalnızca oluştururken; null = genel banka. Banka kursu sonradan değiştirilemez. */
  courseId?: string | null;
}

type ChoiceInput = { options: { id?: string; text: string; correct: boolean }[] };

/** Gönderilen içerik: seçenek/çift kimlikleri yeni öğelerde boş bırakılır, sunucu üretir. */
export type QuestionContentInput =
  | { type: 'SINGLE_CHOICE'; content: ChoiceInput }
  | { type: 'MULTIPLE_CHOICE'; content: ChoiceInput }
  | { type: 'MATCHING'; content: { pairs: { id?: string; left: string; right: string }[] } }
  | Extract<TypedQuestionContent, { type: 'TRUE_FALSE' | 'FILL_BLANK' | 'SHORT_ANSWER' | 'ESSAY' }>;

/** POST/PATCH /questions gövdesi: tip ile içerik birbirine bağlıdır. */
export type QuestionPayload = QuestionContentInput & {
  stem: string;
  explanation: string | null;
  topic: string | null;
  difficulty: QuestionDifficulty;
  points: number;
};

/** GET /api/v1/question-banks: okunabilen bankalar (eğitmen için genel + atandığı kurslar). */
export function useQuestionBanks() {
  const { data, loading, error, reload } = useApiResource<{ banks: QuestionBank[] }>('/api/v1/question-banks');
  return { banks: data?.banks ?? [], loading, error, reload };
}

export function useBank(bankId: string | undefined) {
  const { data, setData, loading, error } = useApiResource<{ bank: QuestionBank }>(
    bankId ? `/api/v1/question-banks/${bankId}` : null,
  );
  return {
    bank: data?.bank ?? null,
    setBank: (bank: QuestionBank) => setData({ bank }),
    loading,
    error,
  };
}

export function useBankQuestions(bankId: string | null | undefined) {
  const { data, loading, error, reload } = useApiResource<{ questions: BankQuestion[] }>(
    bankId ? `/api/v1/question-banks/${bankId}/questions` : null,
  );
  return { questions: data?.questions ?? [], loading, error, reload };
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export async function createBank(input: BankInput): Promise<QuestionBank> {
  return (await apiFetch<{ bank: QuestionBank }>('/api/v1/question-banks', json('POST', input))).bank;
}

export async function updateBank(id: string, input: Omit<BankInput, 'courseId'>): Promise<QuestionBank> {
  return (await apiFetch<{ bank: QuestionBank }>(`/api/v1/question-banks/${id}`, json('PATCH', input))).bank;
}

export async function deleteBank(id: string): Promise<void> {
  await apiFetch(`/api/v1/question-banks/${id}`, json('DELETE'));
}

export async function createQuestion(bankId: string, payload: QuestionPayload): Promise<BankQuestion> {
  return (await apiFetch<{ question: BankQuestion }>(`/api/v1/question-banks/${bankId}/questions`, json('POST', payload)))
    .question;
}

export async function updateQuestion(id: string, payload: QuestionPayload): Promise<BankQuestion> {
  return (await apiFetch<{ question: BankQuestion }>(`/api/v1/questions/${id}`, json('PATCH', payload))).question;
}

export async function deleteQuestion(id: string): Promise<void> {
  await apiFetch(`/api/v1/questions/${id}`, json('DELETE'));
}

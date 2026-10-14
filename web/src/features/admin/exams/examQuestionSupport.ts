import type { QuestionType } from '../../../types';

export const isSupportedExamQuestion = (type: QuestionType) => type !== 'MATCHING' && type !== 'ESSAY';

export const EXAM_QUESTION_GUIDANCE =
  'Tek seçim, çoklu seçim, doğru / yanlış, kısa cevap ve boşluk doldurma soruları kullanılabilir. Eşleştirme ve açık uçlu (essay) sorular öğrenci sınav ekranında henüz desteklenmediği için sınava eklenemez.';

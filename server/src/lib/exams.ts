import { AppError } from '../errors.js';
import { parseDateTime } from './calendar.js';

export const EXAM_TYPES = ['QUIZ', 'MIDTERM', 'FINAL', 'PRACTICE'] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export const EXAM_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];

export const EXAM_AUDIENCES = ['COURSE', 'SELECTED'] as const;
export type ExamAudience = (typeof EXAM_AUDIENCES)[number];

/** Sunucu saatine göre sınav penceresinin durumu (NFR-81). */
export type ExamAvailability = 'UPCOMING' | 'OPEN' | 'CLOSED';

export const EXAM_LIMITS = {
  title: 200,
  description: 5000,
  maxDurationMinutes: 600,
  maxAttempts: 10,
} as const;

function validation(message: string): AppError {
  return new AppError('VALIDATION_ERROR', message, 400);
}

export interface RawExamSettings {
  title?: unknown;
  description?: unknown;
  type?: unknown;
  status?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  durationMinutes?: unknown;
  maxAttempts?: unknown;
  passingScore?: unknown;
  shuffleQuestions?: unknown;
  shuffleOptions?: unknown;
  randomQuestionCount?: unknown;
  showResults?: unknown;
  audience?: unknown;
  learningObjectives?: unknown;
  requiresCourseCompletion?: unknown;
}

export interface ExamSettings {
  title: string;
  description: string | null;
  type: ExamType;
  status: ExamStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  durationMinutes: number | null;
  maxAttempts: number;
  passingScore: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  randomQuestionCount: number | null;
  showResults: boolean;
  audience: ExamAudience;
  learningObjectives: string;
  requiresCourseCompletion: boolean;
}

export const EXAM_SETTING_FIELDS = [
  'title',
  'description',
  'type',
  'status',
  'startsAt',
  'endsAt',
  'durationMinutes',
  'maxAttempts',
  'passingScore',
  'shuffleQuestions',
  'shuffleOptions',
  'randomQuestionCount',
  'showResults',
  'audience',
  'learningObjectives',
  'requiresCourseCompletion',
] as const;

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string, fallback: T): T {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw validation(`${field} şunlardan biri olmalıdır: ${allowed.join(', ')}.`);
  }
  return value as T;
}

function bool(value: unknown, field: string, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') throw validation(`${field} boolean olmalıdır.`);
  return value;
}

function optionalInt(value: unknown, field: string, min: number, max: number): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw validation(`${field} ${min} ile ${max} arasında bir tam sayı olmalıdır.`);
  }
  return value;
}

function optionalInstant(value: unknown, field: string): Date | null {
  if (value === undefined || value === null) return null;
  const date = parseDateTime(value);
  if (!date) throw validation(`${field} ofset veya Z içeren ISO tarih-saat olmalıdır.`);
  return date;
}

function objectives(value: unknown): string {
  if (value === undefined) return '[]';
  if (!Array.isArray(value) || value.length > 20 || value.some((item) => typeof item !== 'string' || item.trim().length === 0 || item.trim().length > 500)) {
    throw validation('learningObjectives en fazla 20 hedef içermeli; her hedef 1–500 karakter olmalıdır.');
  }
  return JSON.stringify([...new Set((value as string[]).map((item) => item.trim()))]);
}

/** Sınav ayarlarını (oluşturma gövdesi ya da PATCH birleşimi) doğrular. */
export function normalizeExamSettings(raw: RawExamSettings): ExamSettings {
  if (typeof raw.title !== 'string') throw validation('title zorunludur.');
  const title = raw.title.trim();
  if (title.length < 1 || title.length > EXAM_LIMITS.title) {
    throw validation(`title 1 ile ${EXAM_LIMITS.title} karakter arasında olmalıdır.`);
  }

  let description: string | null = null;
  if (raw.description !== undefined && raw.description !== null) {
    if (typeof raw.description !== 'string') throw validation('description metin olmalıdır.');
    const trimmed = raw.description.trim();
    if (trimmed.length > EXAM_LIMITS.description) {
      throw validation(`description en fazla ${EXAM_LIMITS.description} karakter olabilir.`);
    }
    description = trimmed === '' ? null : trimmed;
  }

  const startsAt = optionalInstant(raw.startsAt, 'startsAt');
  const endsAt = optionalInstant(raw.endsAt, 'endsAt');
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw validation('Bitiş zamanı başlangıçtan sonra olmalıdır.');
  }

  const durationMinutes = optionalInt(raw.durationMinutes, 'durationMinutes', 1, EXAM_LIMITS.maxDurationMinutes);
  if (startsAt && endsAt && durationMinutes !== null) {
    const windowMinutes = (endsAt.getTime() - startsAt.getTime()) / 60000;
    if (durationMinutes > windowMinutes) {
      throw validation('Sınav süresi, başlangıç ile bitiş arasındaki süreden uzun olamaz.');
    }
  }

  return {
    title,
    description,
    type: oneOf(raw.type, EXAM_TYPES, 'type', 'QUIZ'),
    status: oneOf(raw.status, EXAM_STATUSES, 'status', 'DRAFT'),
    startsAt,
    endsAt,
    durationMinutes,
    maxAttempts: optionalInt(raw.maxAttempts, 'maxAttempts', 1, EXAM_LIMITS.maxAttempts) ?? 1,
    passingScore: optionalInt(raw.passingScore, 'passingScore', 0, 100),
    shuffleQuestions: bool(raw.shuffleQuestions, 'shuffleQuestions', false),
    shuffleOptions: bool(raw.shuffleOptions, 'shuffleOptions', false),
    randomQuestionCount: optionalInt(raw.randomQuestionCount, 'randomQuestionCount', 1, 1000),
    showResults: bool(raw.showResults, 'showResults', true),
    audience: oneOf(raw.audience, EXAM_AUDIENCES, 'audience', 'COURSE'),
    learningObjectives: objectives(raw.learningObjectives),
    requiresCourseCompletion: bool(raw.requiresCourseCompletion, 'requiresCourseCompletion', false),
  };
}

type StoredSettings = Omit<ExamSettings, 'type' | 'status' | 'audience'> & {
  type: string;
  status: string;
  audience: string;
};

/** Mevcut kaydı PATCH birleşimi için API'nin kullandığı ham biçime çevirir. */
export function toRawSettings(exam: StoredSettings): Record<(typeof EXAM_SETTING_FIELDS)[number], unknown> {
  return {
    title: exam.title,
    description: exam.description,
    type: exam.type,
    status: exam.status,
    startsAt: exam.startsAt?.toISOString() ?? null,
    endsAt: exam.endsAt?.toISOString() ?? null,
    durationMinutes: exam.durationMinutes,
    maxAttempts: exam.maxAttempts,
    passingScore: exam.passingScore,
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
    randomQuestionCount: exam.randomQuestionCount,
    showResults: exam.showResults,
    audience: exam.audience,
    learningObjectives: JSON.parse(exam.learningObjectives),
    requiresCourseCompletion: exam.requiresCourseCompletion,
  };
}

export function examAvailability(exam: { startsAt: Date | null; endsAt: Date | null }, now: Date): ExamAvailability {
  if (exam.startsAt && now.getTime() < exam.startsAt.getTime()) return 'UPCOMING';
  if (exam.endsAt && now.getTime() >= exam.endsAt.getTime()) return 'CLOSED';
  return 'OPEN';
}

/** Öğrencinin göreceği soru sayısı: rastgele seçim varsa o sayı, yoksa bağlı soruların tamamı. */
export function effectiveQuestionCount(randomQuestionCount: number | null, linkedCount: number): number {
  return randomQuestionCount === null ? linkedCount : Math.min(randomQuestionCount, linkedCount);
}

/** Yayındaki bir sınavın sağlaması gereken koşullar; boş dizi = yayınlanabilir. */
export function publishProblems(input: {
  questionCount: number;
  randomQuestionCount: number | null;
  audience: string;
  candidateCount: number;
}): string[] {
  const problems: string[] = [];
  if (input.questionCount === 0) problems.push('Sınavda en az bir soru olmalıdır.');
  if (input.randomQuestionCount !== null && input.randomQuestionCount > input.questionCount) {
    problems.push(
      `Rastgele seçilecek soru sayısı (${input.randomQuestionCount}) sınavdaki soru sayısını (${input.questionCount}) aşamaz.`,
    );
  }
  if (input.audience === 'SELECTED' && input.candidateCount === 0) {
    problems.push('"Seçili öğrenciler" modunda en az bir öğrenci seçilmelidir.');
  }
  return problems;
}

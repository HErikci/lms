import type { Exam, ExamAttempt, Prisma } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { AppError } from '../errors.js';
import { examAvailability } from './exams.js';
import { normalizeContent, type ContentByType } from './questions.js';

type Db = Prisma.TransactionClient;
export type Answer = string | boolean | string[];
export type Answers = Record<string, Answer>;
const SUPPORTED = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'FILL_BLANK'] as const;
type SupportedType = (typeof SUPPORTED)[number];
type SnapshotQuestion = { [T in SupportedType]: {
  id: string; type: T; stem: string; points: number; content: ContentByType[T]; explanation: string | null;
} }[SupportedType];
interface Snapshot {
  title: string;
  learningObjectives: string[];
  passingScore: number | null;
  showResults: boolean;
  questions: SnapshotQuestion[];
}
interface Result {
  score: number;
  earnedPoints: number;
  totalPoints: number;
  passed: boolean | null;
  feedback: { questionId: string; correct: boolean; correctAnswer: Answer; explanation: string | null }[];
}

function validation(message: string) { return new AppError('VALIDATION_ERROR', message, 400); }

export async function loadStudentExam(db: Db, examId: string, userId: string): Promise<Exam> {
  const exam = await db.exam.findFirst({
    where: {
      id: examId, status: 'PUBLISHED',
      course: { status: 'PUBLISHED', enrollments: { some: { userId } } },
      OR: [{ audience: 'COURSE' }, { audience: 'SELECTED', candidates: { some: { userId } } }],
    },
  });
  if (!exam) throw new AppError('NOT_FOUND', 'Sınav bulunamadı veya bu sınava erişiminiz yok.', 404);
  return exam;
}

export async function courseCompleted(db: Db, courseId: string, userId: string): Promise<boolean> {
  const where = { status: 'PUBLISHED', module: { courseId } };
  const [total, completed] = await Promise.all([
    db.lesson.count({ where }),
    db.lesson.count({ where: { ...where, lessonProgress: { some: { userId } } } }),
  ]);
  return total > 0 && completed === total;
}

export async function startBlockedReason(db: Db, exam: Exam, completed: boolean, attemptsUsed: number, now: Date): Promise<string | null> {
  const availability = examAvailability(exam, now);
  if (availability === 'UPCOMING') return 'Sınav henüz başlamadı.';
  if (availability === 'CLOSED') return 'Sınavın erişim süresi doldu.';
  if (exam.requiresCourseCompletion && !completed) return 'Sınava başlamadan önce kurstaki yayımlanmış tüm dersleri tamamlayın.';
  if (attemptsUsed >= exam.maxAttempts) return 'Sınav için deneme hakkınız kalmadı.';
  const links = await db.examQuestion.findMany({ where: { examId: exam.id }, select: { question: { select: { type: true } } } });
  if (!links.length || (exam.randomQuestionCount !== null && exam.randomQuestionCount > links.length)) return 'Sınavın soruları henüz hazır değil.';
  if (links.some(({ question }) => !(SUPPORTED as readonly string[]).includes(question.type))) return 'Bu sınavdaki soru türleri çevrimiçi basit sınavda desteklenmiyor.';
  return null;
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function makeSnapshot(db: Db, exam: Exam): Promise<Snapshot> {
  let links = await db.examQuestion.findMany({ where: { examId: exam.id }, include: { question: true }, orderBy: { position: 'asc' } });
  if (exam.randomQuestionCount !== null) {
    // Select randomly, then keep staff order unless question shuffling is enabled.
    const selected = new Set(shuffled(links).slice(0, exam.randomQuestionCount).map((link) => link.id));
    links = links.filter((link) => selected.has(link.id));
  }
  if (exam.shuffleQuestions) links = shuffled(links);
  const questions = links.map(({ question, points }) => {
    const type = question.type as SupportedType;
    let content = normalizeContent(type, JSON.parse(question.content), question.stem);
    if (exam.shuffleOptions && 'options' in content) content = { options: shuffled(content.options) };
    return { id: question.id, type, stem: question.stem, points, content, explanation: question.explanation } as SnapshotQuestion;
  });
  return { title: exam.title, learningObjectives: JSON.parse(exam.learningObjectives), passingScore: exam.passingScore, showResults: exam.showResults, questions };
}

export function attemptDeadline(exam: Exam, now: Date): Date | null {
  const limit = exam.durationMinutes === null ? null : new Date(now.getTime() + exam.durationMinutes * 60000);
  if (!exam.endsAt) return limit;
  return limit && limit < exam.endsAt ? limit : exam.endsAt;
}

export function parseAnswers(body: unknown, attempt: ExamAttempt): Answers {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw validation('İstek gövdesi bir nesne olmalıdır.');
  const raw = (body as Record<string, unknown>).answers;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw validation('answers bir cevap nesnesi olmalıdır.');
  const snapshot: Snapshot = JSON.parse(attempt.snapshot);
  const byId = new Map(snapshot.questions.map((q) => [q.id, q]));
  const answers: Answers = Object.create(null);
  for (const [id, answer] of Object.entries(raw)) {
    const q = byId.get(id);
    if (!q) throw validation('Cevaplar yalnızca bu denemedeki soruların kimliklerini içerebilir.');
    switch (q.type) {
      case 'TRUE_FALSE':
        if (typeof answer !== 'boolean') throw validation('Doğru/yanlış cevabı boolean olmalıdır.');
        break;
      case 'SINGLE_CHOICE':
        if (typeof answer !== 'string' || !q.content.options.some((o) => o.id === answer)) throw validation('Geçerli bir seçenek seçin.');
        break;
      case 'MULTIPLE_CHOICE':
        if (!Array.isArray(answer) || answer.length > q.content.options.length || new Set(answer).size !== answer.length || answer.some((a) => typeof a !== 'string' || !q.content.options.some((o) => o.id === a))) throw validation('Geçerli ve benzersiz seçenekler seçin.');
        break;
      case 'SHORT_ANSWER':
        if (typeof answer !== 'string' || answer.length > 200) throw validation('Kısa cevap en fazla 200 karakter olmalıdır.');
        break;
      case 'FILL_BLANK':
        if (!Array.isArray(answer) || answer.length !== q.content.blanks.length || answer.some((a) => typeof a !== 'string' || a.length > 200)) throw validation('Her boşluk için en fazla 200 karakterlik bir cevap gönderin.');
        break;
    }
    answers[id] = answer as Answer;
  }
  return answers;
}

function textMatches(answer: unknown, accepted: string[], caseSensitive: boolean): boolean {
  if (typeof answer !== 'string') return false;
  const normalized = (value: string) => caseSensitive ? value.trim() : value.trim().toLocaleLowerCase('tr');
  return accepted.some((candidate) => normalized(candidate) === normalized(answer));
}

export function gradeAttempt(attempt: ExamAttempt, answers: Answers): Result {
  const snapshot: Snapshot = JSON.parse(attempt.snapshot);
  let earnedPoints = 0;
  let totalPoints = 0;
  const feedback = snapshot.questions.map((q) => {
    const answer = answers[q.id];
    let correct = false;
    let correctAnswer: Answer;
    switch (q.type) {
      case 'SINGLE_CHOICE':
        correctAnswer = q.content.options.find((o) => o.correct)!.id;
        correct = answer === correctAnswer;
        break;
      case 'MULTIPLE_CHOICE': {
        correctAnswer = q.content.options.filter((o) => o.correct).map((o) => o.id);
        correct = Array.isArray(answer) && answer.length === correctAnswer.length && correctAnswer.every((id) => answer.includes(id));
        break;
      }
      case 'TRUE_FALSE':
        correctAnswer = q.content.correctAnswer;
        correct = answer === correctAnswer;
        break;
      case 'SHORT_ANSWER':
        correctAnswer = q.content.accepted[0];
        correct = textMatches(answer, q.content.accepted, q.content.caseSensitive);
        break;
      case 'FILL_BLANK':
        correctAnswer = q.content.blanks.map((blank) => blank.accepted[0]);
        correct = Array.isArray(answer) && answer.length === q.content.blanks.length && q.content.blanks.every((blank, i) => textMatches(answer[i], blank.accepted, q.content.caseSensitive));
        break;
    }
    totalPoints += q.points;
    if (correct) earnedPoints += q.points;
    return { questionId: q.id, correct, correctAnswer, explanation: q.explanation };
  });
  const score = totalPoints === 0 ? 0 : Math.round(earnedPoints / totalPoints * 10000) / 100;
  return { score, earnedPoints, totalPoints, passed: snapshot.passingScore === null ? null : score >= snapshot.passingScore, feedback };
}

export async function finalizeAttempt(db: Db, attempt: ExamAttempt, answers: Answers, now: Date): Promise<ExamAttempt> {
  if (attempt.status === 'SUBMITTED') return attempt;
  return db.examAttempt.update({
    where: { id: attempt.id },
    data: { status: 'SUBMITTED', submittedAt: now, answers: JSON.stringify(answers), result: JSON.stringify(gradeAttempt(attempt, answers)) },
  });
}

export async function expireAttempt(db: Db, attempt: ExamAttempt | null, now: Date): Promise<ExamAttempt | null> {
  if (attempt?.status === 'IN_PROGRESS' && attempt.deadlineAt && now >= attempt.deadlineAt) {
    return finalizeAttempt(db, attempt, JSON.parse(attempt.answers), now);
  }
  return attempt;
}

export function serializeAttempt(attempt: ExamAttempt) {
  const snapshot: Snapshot = JSON.parse(attempt.snapshot);
  const result: Result | null = attempt.result ? JSON.parse(attempt.result) : null;
  return {
    id: attempt.id, examId: attempt.examId, title: snapshot.title, status: attempt.status as 'IN_PROGRESS' | 'SUBMITTED',
    startedAt: attempt.startedAt.toISOString(), deadlineAt: attempt.deadlineAt?.toISOString() ?? null,
    submittedAt: attempt.submittedAt?.toISOString() ?? null, learningObjectives: snapshot.learningObjectives,
    questions: snapshot.questions.map((q) => ({
      id: q.id, type: q.type, stem: q.stem, points: q.points,
      content: 'options' in q.content ? { options: q.content.options.map(({ id, text }) => ({ id, text })) }
        : 'blanks' in q.content ? { blankCount: q.content.blanks.length } : {},
    })),
    answers: JSON.parse(attempt.answers) as Answers,
    result: result ? { ...result, feedback: snapshot.showResults ? result.feedback : null } : null,
  };
}

import { randomBytes } from 'node:crypto';
import { AppError } from '../errors.js';

export const QUESTION_TYPES = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'FILL_BLANK',
  'MATCHING',
  'SHORT_ANSWER',
  'ESSAY',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const QUESTION_LIMITS = {
  stem: 5000,
  explanation: 5000,
  topic: 100,
  optionText: 1000,
  minOptions: 2,
  maxOptions: 10,
  pairText: 500,
  minPairs: 2,
  maxPairs: 20,
  answer: 200,
  maxAnswers: 20,
  maxBlanks: 20,
  rubric: 5000,
  minPoints: 1,
  maxPoints: 100,
} as const;

/** FILL_BLANK sorusunda her boşluk soru metninde en az üç alt çizgiyle işaretlenir. */
export const BLANK_PATTERN = /_{3,}/g;

export interface ChoiceOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

/** Tipe göre saklanan (ve yönetim API'sinde dönen) içerik. Doğru cevapları içerir. */
export interface ContentByType {
  SINGLE_CHOICE: { options: ChoiceOption[] };
  MULTIPLE_CHOICE: { options: ChoiceOption[] };
  TRUE_FALSE: { correctAnswer: boolean };
  FILL_BLANK: { blanks: { accepted: string[] }[]; caseSensitive: boolean };
  MATCHING: { pairs: MatchingPair[] };
  SHORT_ANSWER: { accepted: string[]; caseSensitive: boolean };
  ESSAY: { rubric: string | null };
}
export type QuestionContent = ContentByType[QuestionType];

export interface QuestionData {
  type: QuestionType;
  stem: string;
  content: QuestionContent;
  explanation: string | null;
  topic: string | null;
  difficulty: Difficulty;
  points: number;
}

export interface RawQuestionInput {
  type?: unknown;
  stem?: unknown;
  content?: unknown;
  explanation?: unknown;
  topic?: unknown;
  difficulty?: unknown;
  points?: unknown;
}

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

function validation(message: string): AppError {
  return new AppError('VALIDATION_ERROR', message, 400);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function newId(): string {
  return randomBytes(4).toString('hex');
}

function requiredText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') throw validation(`${field} zorunludur.`);
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > max) {
    throw validation(`${field} 1 ile ${max} karakter arasında olmalıdır.`);
  }
  return trimmed;
}

function optionalText(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw validation(`${field} metin olmalıdır.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw validation(`${field} en fazla ${max} karakter olabilir.`);
  return trimmed === '' ? null : trimmed;
}

function optionalBoolean(value: unknown, field: string, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') throw validation(`${field} boolean olmalıdır.`);
  return value;
}

/** İstemcinin gönderdiği kimliği korur (düzenlemede kararlılık için), yoksa üretir; tekrarı reddeder. */
function stableId(value: unknown, seen: Set<string>, field: string): string {
  let id: string;
  if (value === undefined || value === null || value === '') {
    do id = newId();
    while (seen.has(id));
  } else {
    if (typeof value !== 'string' || !ID_RE.test(value)) {
      throw validation(`${field} kimliği yalnızca harf, rakam, "-" ve "_" içerebilir (en fazla 40 karakter).`);
    }
    if (seen.has(value)) throw validation(`${field} kimlikleri benzersiz olmalıdır.`);
    id = value;
  }
  seen.add(id);
  return id;
}

/** Kabul edilen cevap listesi: kırpılır, boşlar atılır, (büyük/küçük harf ayarına göre) tekrarlar ayıklanır. */
function acceptedAnswers(value: unknown, field: string, caseSensitive: boolean): string[] {
  if (!Array.isArray(value)) throw validation(`${field} bir metin dizisi olmalıdır.`);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') throw validation(`${field} yalnızca metin içerebilir.`);
    const answer = item.trim();
    if (answer === '') continue;
    if (answer.length > QUESTION_LIMITS.answer) {
      throw validation(`${field} içindeki her cevap en fazla ${QUESTION_LIMITS.answer} karakter olabilir.`);
    }
    const key = caseSensitive ? answer : answer.toLocaleLowerCase('tr');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(answer);
  }
  if (result.length < 1 || result.length > QUESTION_LIMITS.maxAnswers) {
    throw validation(`${field} 1 ile ${QUESTION_LIMITS.maxAnswers} arasında cevap içermelidir.`);
  }
  return result;
}

function choiceContent(raw: Record<string, unknown>, single: boolean): ContentByType['SINGLE_CHOICE'] {
  const { minOptions, maxOptions, optionText } = QUESTION_LIMITS;
  if (!Array.isArray(raw.options) || raw.options.length < minOptions || raw.options.length > maxOptions) {
    throw validation(`Seçenek sayısı ${minOptions} ile ${maxOptions} arasında olmalıdır.`);
  }
  const seen = new Set<string>();
  const texts = new Set<string>();
  const options = raw.options.map((option, index) => {
    if (!isObject(option)) throw validation('Her seçenek bir nesne olmalıdır.');
    const text = requiredText(option.text, `${index + 1}. seçenek`, optionText);
    const key = text.toLocaleLowerCase('tr');
    if (texts.has(key)) throw validation('Seçenek metinleri birbirinden farklı olmalıdır.');
    texts.add(key);
    return {
      id: stableId(option.id, seen, 'Seçenek'),
      text,
      correct: optionalBoolean(option.correct, 'correct', false),
    };
  });
  const correctCount = options.filter((option) => option.correct).length;
  if (single && correctCount !== 1) throw validation('Tek cevaplı soruda tam olarak bir doğru seçenek olmalıdır.');
  if (!single && correctCount < 1) throw validation('Çok cevaplı soruda en az bir doğru seçenek olmalıdır.');
  return { options };
}

function matchingContent(raw: Record<string, unknown>): ContentByType['MATCHING'] {
  const { minPairs, maxPairs, pairText } = QUESTION_LIMITS;
  if (!Array.isArray(raw.pairs) || raw.pairs.length < minPairs || raw.pairs.length > maxPairs) {
    throw validation(`Eşleştirme çifti sayısı ${minPairs} ile ${maxPairs} arasında olmalıdır.`);
  }
  const seen = new Set<string>();
  const lefts = new Set<string>();
  const rights = new Set<string>();
  const pairs = raw.pairs.map((pair, index) => {
    if (!isObject(pair)) throw validation('Her eşleştirme çifti bir nesne olmalıdır.');
    const left = requiredText(pair.left, `${index + 1}. çiftin sol tarafı`, pairText);
    const right = requiredText(pair.right, `${index + 1}. çiftin sağ tarafı`, pairText);
    // Aynı metin iki kez geçerse doğru eşleşme belirsizleşir.
    const leftKey = left.toLocaleLowerCase('tr');
    const rightKey = right.toLocaleLowerCase('tr');
    if (lefts.has(leftKey) || rights.has(rightKey)) {
      throw validation('Eşleştirmede her sol ve her sağ öğe benzersiz olmalıdır.');
    }
    lefts.add(leftKey);
    rights.add(rightKey);
    return { id: stableId(pair.id, seen, 'Çift'), left, right };
  });
  return { pairs };
}

function fillBlankContent(raw: Record<string, unknown>, stem: string): ContentByType['FILL_BLANK'] {
  const blankCount = stem.match(BLANK_PATTERN)?.length ?? 0;
  if (blankCount < 1) throw validation('Boşluk doldurma sorusunda metin en az bir "___" boşluğu içermelidir.');
  if (blankCount > QUESTION_LIMITS.maxBlanks) {
    throw validation(`Bir soruda en fazla ${QUESTION_LIMITS.maxBlanks} boşluk olabilir.`);
  }
  if (!Array.isArray(raw.blanks) || raw.blanks.length !== blankCount) {
    throw validation(`Metindeki ${blankCount} boşluğun her biri için kabul edilen cevaplar tanımlanmalıdır.`);
  }
  const caseSensitive = optionalBoolean(raw.caseSensitive, 'caseSensitive', false);
  const blanks = raw.blanks.map((blank, index) => {
    if (!isObject(blank)) throw validation('Her boşluk bir nesne olmalıdır.');
    return { accepted: acceptedAnswers(blank.accepted, `${index + 1}. boşluk`, caseSensitive) };
  });
  return { blanks, caseSensitive };
}

/** Tipe özgü içeriği doğrular ve saklanacak biçime çevirir. */
export function normalizeContent(type: QuestionType, raw: unknown, stem: string): QuestionContent {
  const content = isObject(raw) ? raw : {};
  switch (type) {
    case 'SINGLE_CHOICE':
      return choiceContent(content, true);
    case 'MULTIPLE_CHOICE':
      return choiceContent(content, false);
    case 'TRUE_FALSE':
      if (typeof content.correctAnswer !== 'boolean') throw validation('Doğru-yanlış sorusunda doğru cevap seçilmelidir.');
      return { correctAnswer: content.correctAnswer };
    case 'FILL_BLANK':
      return fillBlankContent(content, stem);
    case 'MATCHING':
      return matchingContent(content);
    case 'SHORT_ANSWER': {
      const caseSensitive = optionalBoolean(content.caseSensitive, 'caseSensitive', false);
      return { accepted: acceptedAnswers(content.accepted, 'Kabul edilen cevaplar', caseSensitive), caseSensitive };
    }
    case 'ESSAY':
      return { rubric: optionalText(content.rubric, 'Rubrik', QUESTION_LIMITS.rubric) };
  }
}

/** Soru gövdesini (oluşturma ya da PATCH birleşimi) doğrular. */
export function normalizeQuestionInput(raw: RawQuestionInput): QuestionData {
  if (typeof raw.type !== 'string' || !(QUESTION_TYPES as readonly string[]).includes(raw.type)) {
    throw validation(`type şunlardan biri olmalıdır: ${QUESTION_TYPES.join(', ')}.`);
  }
  const type = raw.type as QuestionType;
  const stem = requiredText(raw.stem, 'Soru metni', QUESTION_LIMITS.stem);

  const difficulty = raw.difficulty === undefined || raw.difficulty === null ? 'MEDIUM' : raw.difficulty;
  if (typeof difficulty !== 'string' || !(DIFFICULTIES as readonly string[]).includes(difficulty)) {
    throw validation(`difficulty şunlardan biri olmalıdır: ${DIFFICULTIES.join(', ')}.`);
  }

  const points = raw.points === undefined || raw.points === null ? 1 : raw.points;
  if (
    typeof points !== 'number' ||
    !Number.isInteger(points) ||
    points < QUESTION_LIMITS.minPoints ||
    points > QUESTION_LIMITS.maxPoints
  ) {
    throw validation(`Puan ${QUESTION_LIMITS.minPoints} ile ${QUESTION_LIMITS.maxPoints} arasında bir tam sayı olmalıdır.`);
  }

  return {
    type,
    stem,
    content: normalizeContent(type, raw.content, stem),
    explanation: optionalText(raw.explanation, 'Açıklama', QUESTION_LIMITS.explanation),
    topic: optionalText(raw.topic, 'Konu', QUESTION_LIMITS.topic),
    difficulty: difficulty as Difficulty,
    points,
  };
}

export interface StoredQuestion {
  id: string;
  type: string;
  stem: string;
  content: string;
  explanation: string | null;
  topic: string | null;
  difficulty: string;
  points: number;
  bank: { id: string; name: string; courseId: string | null };
  createdBy: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { examLinks: number };
}

/** Mevcut kaydı PATCH birleşimi için API'nin kullandığı ham biçime çevirir. */
export function toRawQuestion(question: Omit<StoredQuestion, 'bank' | 'createdBy' | '_count' | 'createdAt' | 'updatedAt'>): RawQuestionInput {
  return {
    type: question.type,
    stem: question.stem,
    content: JSON.parse(question.content),
    explanation: question.explanation,
    topic: question.topic,
    difficulty: question.difficulty,
    points: question.points,
  };
}

/** Yönetim API'sindeki soru nesnesi (doğru cevaplar dahil; yalnızca ADMIN/INSTRUCTOR'a döner). */
export function serializeQuestion(question: StoredQuestion, canEdit: boolean) {
  return {
    id: question.id,
    bank: { id: question.bank.id, name: question.bank.name },
    type: question.type as QuestionType,
    stem: question.stem,
    content: JSON.parse(question.content) as QuestionContent,
    explanation: question.explanation,
    topic: question.topic,
    difficulty: question.difficulty as Difficulty,
    points: question.points,
    usageCount: question._count.examLinks,
    createdBy: question.createdBy ? { id: question.createdBy.id, name: question.createdBy.name } : null,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
    canEdit,
  };
}

export const questionInclude = {
  bank: { select: { id: true, name: true, courseId: true } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { examLinks: true } },
} as const;

type BankViewer = { role: string };

/** ADMIN her bankayı, aktif rolü INSTRUCTOR olan eğitmen yalnızca atandığı kursların bankalarını düzenler. */
export function canEditBank(user: BankViewer, courseId: string | null, assigned: ReadonlySet<string>): boolean {
  if (user.role === 'ADMIN') return true;
  return user.role === 'INSTRUCTOR' && courseId !== null && assigned.has(courseId);
}

/** Okuma (ve sınavda kullanma): ADMIN hepsi; eğitmen genel bankalar + atandığı kursların bankaları. */
export function canReadBank(user: BankViewer, courseId: string | null, assigned: ReadonlySet<string>): boolean {
  if (user.role === 'ADMIN') return true;
  return user.role === 'INSTRUCTOR' && (courseId === null || assigned.has(courseId));
}

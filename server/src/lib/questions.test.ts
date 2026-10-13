import { describe, it, expect } from 'vitest';
import { normalizeQuestionInput } from './questions.js';
import { examAvailability, normalizeExamSettings, publishProblems } from './exams.js';

const choice = (options: { text: string; correct?: boolean; id?: string }[]) => ({ options });

describe('normalizeQuestionInput', () => {
  it('applies defaults and trims text', () => {
    const data = normalizeQuestionInput({
      type: 'TRUE_FALSE',
      stem: '  Dünya yuvarlaktır. ',
      content: { correctAnswer: true },
      topic: '  ',
    });
    expect(data).toMatchObject({
      stem: 'Dünya yuvarlaktır.',
      difficulty: 'MEDIUM',
      points: 1,
      topic: null,
      explanation: null,
      content: { correctAnswer: true },
    });
  });

  it('validates points and difficulty', () => {
    const base = { type: 'TRUE_FALSE', stem: 'x', content: { correctAnswer: false } };
    expect(() => normalizeQuestionInput({ ...base, points: 0 })).toThrow();
    expect(() => normalizeQuestionInput({ ...base, points: 1.5 })).toThrow();
    expect(() => normalizeQuestionInput({ ...base, difficulty: 'IMPOSSIBLE' })).toThrow();
    expect(() => normalizeQuestionInput({ ...base, type: 'POLL' })).toThrow();
    expect(() => normalizeQuestionInput({ ...base, content: {} })).toThrow();
  });

  describe('choice questions', () => {
    it('requires exactly one correct option for single choice', () => {
      const stem = 'Başkent?';
      expect(() =>
        normalizeQuestionInput({ type: 'SINGLE_CHOICE', stem, content: choice([{ text: 'A' }, { text: 'B' }]) }),
      ).toThrow(/tam olarak bir/);
      expect(() =>
        normalizeQuestionInput({
          type: 'SINGLE_CHOICE',
          stem,
          content: choice([
            { text: 'A', correct: true },
            { text: 'B', correct: true },
          ]),
        }),
      ).toThrow();
    });

    it('allows several correct options for multiple choice but at least one', () => {
      const data = normalizeQuestionInput({
        type: 'MULTIPLE_CHOICE',
        stem: 'Asal sayılar?',
        content: choice([
          { text: '2', correct: true },
          { text: '3', correct: true },
          { text: '4' },
        ]),
      });
      expect((data.content as { options: unknown[] }).options).toHaveLength(3);
      expect(() =>
        normalizeQuestionInput({ type: 'MULTIPLE_CHOICE', stem: 'x', content: choice([{ text: 'a' }, { text: 'b' }]) }),
      ).toThrow();
    });

    it('keeps provided option ids, generates missing ones and rejects duplicates', () => {
      const data = normalizeQuestionInput({
        type: 'SINGLE_CHOICE',
        stem: 'x',
        content: choice([{ id: 'opt-a', text: 'A', correct: true }, { text: 'B' }]),
      });
      const [first, second] = (data.content as { options: { id: string }[] }).options;
      expect(first.id).toBe('opt-a');
      expect(second.id).toMatch(/^[0-9a-f]{8}$/);
      expect(() =>
        normalizeQuestionInput({
          type: 'SINGLE_CHOICE',
          stem: 'x',
          content: choice([
            { id: 'a', text: 'A', correct: true },
            { id: 'a', text: 'B' },
          ]),
        }),
      ).toThrow();
    });

    it('rejects too few options and duplicate option texts (case-insensitive)', () => {
      expect(() =>
        normalizeQuestionInput({ type: 'SINGLE_CHOICE', stem: 'x', content: choice([{ text: 'A', correct: true }]) }),
      ).toThrow();
      expect(() =>
        normalizeQuestionInput({
          type: 'SINGLE_CHOICE',
          stem: 'x',
          content: choice([{ text: 'Elma', correct: true }, { text: 'elma' }]),
        }),
      ).toThrow(/farklı/);
    });
  });

  describe('fill in the blank', () => {
    it('requires one answer set per ___ marker', () => {
      const data = normalizeQuestionInput({
        type: 'FILL_BLANK',
        stem: 'Türkiye’nin başkenti ___, en kalabalık şehri _____ şehridir.',
        content: { blanks: [{ accepted: ['Ankara'] }, { accepted: ['İstanbul', 'istanbul', ' Istanbul '] }] },
      });
      // Büyük/küçük harf duyarsızken "İstanbul" ve "istanbul" aynı sayılır (Türkçe kurallarıyla).
      expect(data.content).toEqual({
        blanks: [{ accepted: ['Ankara'] }, { accepted: ['İstanbul', 'Istanbul'] }],
        caseSensitive: false,
      });
      expect(() =>
        normalizeQuestionInput({ type: 'FILL_BLANK', stem: 'A ___ B ___', content: { blanks: [{ accepted: ['x'] }] } }),
      ).toThrow(/2 boşluğun/);
      expect(() =>
        normalizeQuestionInput({ type: 'FILL_BLANK', stem: 'Boşluk yok', content: { blanks: [] } }),
      ).toThrow();
    });

    it('keeps case variants when case sensitive', () => {
      const data = normalizeQuestionInput({
        type: 'FILL_BLANK',
        stem: 'Element: ___',
        content: { blanks: [{ accepted: ['Co', 'CO'] }], caseSensitive: true },
      });
      expect(data.content).toEqual({ blanks: [{ accepted: ['Co', 'CO'] }], caseSensitive: true });
    });
  });

  it('validates matching pairs', () => {
    const data = normalizeQuestionInput({
      type: 'MATCHING',
      stem: 'Eşleştirin',
      content: {
        pairs: [
          { left: 'Fransa', right: 'Paris' },
          { left: 'Japonya', right: 'Tokyo' },
        ],
      },
    });
    expect((data.content as { pairs: unknown[] }).pairs).toHaveLength(2);
    expect(() =>
      normalizeQuestionInput({ type: 'MATCHING', stem: 'x', content: { pairs: [{ left: 'a', right: 'b' }] } }),
    ).toThrow();
    expect(() =>
      normalizeQuestionInput({
        type: 'MATCHING',
        stem: 'x',
        content: {
          pairs: [
            { left: 'a', right: 'b' },
            { left: 'c', right: 'B' },
          ],
        },
      }),
    ).toThrow(/benzersiz/);
  });

  it('validates short answer and essay', () => {
    expect(
      normalizeQuestionInput({ type: 'SHORT_ANSWER', stem: 'x', content: { accepted: ['  cevap '] } }).content,
    ).toEqual({ accepted: ['cevap'], caseSensitive: false });
    expect(() => normalizeQuestionInput({ type: 'SHORT_ANSWER', stem: 'x', content: { accepted: ['  '] } })).toThrow();
    expect(normalizeQuestionInput({ type: 'ESSAY', stem: 'x' }).content).toEqual({ rubric: null });
    expect(normalizeQuestionInput({ type: 'ESSAY', stem: 'x', content: { rubric: ' Giriş 2p ' } }).content).toEqual({
      rubric: 'Giriş 2p',
    });
  });
});

describe('exam settings', () => {
  it('applies defaults', () => {
    expect(normalizeExamSettings({ title: ' Ara Sınav ' })).toEqual({
      title: 'Ara Sınav',
      description: null,
      type: 'QUIZ',
      status: 'DRAFT',
      startsAt: null,
      endsAt: null,
      durationMinutes: null,
      maxAttempts: 1,
      passingScore: null,
      shuffleQuestions: false,
      shuffleOptions: false,
      randomQuestionCount: null,
      showResults: true,
      audience: 'COURSE',
    });
  });

  it('validates the window and duration', () => {
    const base = { title: 'x', startsAt: '2026-11-01T09:00:00Z' };
    expect(() => normalizeExamSettings({ ...base, endsAt: '2026-11-01T09:00:00Z' })).toThrow(/sonra/);
    expect(() => normalizeExamSettings({ ...base, endsAt: '2026-11-01T10:00:00Z', durationMinutes: 61 })).toThrow(/uzun/);
    expect(normalizeExamSettings({ ...base, endsAt: '2026-11-01T10:00:00Z', durationMinutes: 60 }).durationMinutes).toBe(60);
    expect(() => normalizeExamSettings({ title: 'x', startsAt: '2026-11-01 09:00' })).toThrow();
    expect(() => normalizeExamSettings({ title: 'x', passingScore: 101 })).toThrow();
    expect(() => normalizeExamSettings({ title: 'x', maxAttempts: 0 })).toThrow();
    expect(() => normalizeExamSettings({ title: 'x', audience: 'ALL' })).toThrow();
  });

  it('derives availability from server time', () => {
    const now = new Date('2026-11-01T10:00:00Z');
    const at = (iso: string) => new Date(iso);
    expect(examAvailability({ startsAt: at('2026-11-01T11:00:00Z'), endsAt: null }, now)).toBe('UPCOMING');
    expect(examAvailability({ startsAt: at('2026-11-01T09:00:00Z'), endsAt: at('2026-11-01T10:00:00Z') }, now)).toBe('CLOSED');
    expect(examAvailability({ startsAt: null, endsAt: null }, now)).toBe('OPEN');
  });

  it('lists publish problems', () => {
    expect(publishProblems({ questionCount: 3, randomQuestionCount: null, audience: 'COURSE', candidateCount: 0 })).toEqual([]);
    expect(publishProblems({ questionCount: 0, randomQuestionCount: null, audience: 'COURSE', candidateCount: 0 })).toHaveLength(1);
    expect(publishProblems({ questionCount: 2, randomQuestionCount: 3, audience: 'SELECTED', candidateCount: 0 })).toHaveLength(2);
  });
});

describe('seed data', () => {
  it('only contains questions the API itself would accept', async () => {
    // prisma/ rootDir dışında olduğundan tsc'nin çözümlemeyeceği dinamik import; vitest çalışma anında yükler.
    const seedPath: string = '../../prisma/examSeedData.ts';
    const seed = (await import(seedPath)) as {
      REACT_QUESTIONS: Record<string, unknown>[];
      GENERAL_QUESTIONS: Record<string, unknown>[];
    };
    for (const question of [...seed.REACT_QUESTIONS, ...seed.GENERAL_QUESTIONS]) {
      const normalized = normalizeQuestionInput(question);
      expect(normalized.content).toEqual(question.content);
    }
  });
});

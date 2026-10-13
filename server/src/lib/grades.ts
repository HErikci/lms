/**
 * Quiz notu yardımcıları (saf fonksiyonlar): puan doğrulama, harf notu, seviye, özet ve trend.
 * Veritabanına dokunmaz; rotalar ve birim testler aynı kuralları buradan kullanır.
 */

export const MIN_SCORE = 0;
export const MAX_SCORE = 100;

/** Puan 0..100 arasında bir tam sayı olmalıdır (veritabanı aralığı zorlamaz, API doğrular). */
export function isValidScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_SCORE && value <= MAX_SCORE;
}

export type LetterGrade = 'AA' | 'BA' | 'BB' | 'CB' | 'CC' | 'DC' | 'DD' | 'FD' | 'FF';
export type GradeLevel = 'Yüksek' | 'İyi' | 'Orta' | 'Düşük';

/** Alt sınır (dahil) → harf notu; yukarıdan aşağıya taranır, hiçbiri tutmazsa FF. */
const LETTER_SCALE: readonly (readonly [number, LetterGrade])[] = [
  [90, 'AA'],
  [85, 'BA'],
  [80, 'BB'],
  [75, 'CB'],
  [70, 'CC'],
  [65, 'DC'],
  [60, 'DD'],
  [50, 'FD'],
];

export function letterGradeFor(averageScore: number): LetterGrade {
  for (const [min, letter] of LETTER_SCALE) {
    if (averageScore >= min) return letter;
  }
  return 'FF';
}

export function levelFor(averageScore: number): GradeLevel {
  if (averageScore >= 85) return 'Yüksek';
  if (averageScore >= 70) return 'İyi';
  if (averageScore >= 60) return 'Orta';
  return 'Düşük';
}

/** Ortalamanın yuvarlanmış hali; boş listede null. */
export function roundedMean(scores: readonly number[]): number | null {
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

export interface GradeSummary {
  averageScore: number | null;
  letterGrade: LetterGrade | null;
  level: GradeLevel | null;
  gradeCount: number;
  lastScore: number | null;
  trend: number | null;
}

/**
 * Özet hesabı. `scoresNewestFirst` en yeni nottan eskiye sıralı puanlardır.
 * - averageScore = Math.round(ortalama); harf notu ve seviye bu yuvarlanmış değerden türetilir.
 * - lastScore = en yeni notun puanı.
 * - trend = lastScore - Math.round(en yeni hariç diğer tüm notların ortalaması); 2'den az notta null.
 */
export function computeGradeSummary(scoresNewestFirst: readonly number[]): GradeSummary {
  const averageScore = roundedMean(scoresNewestFirst);
  if (averageScore === null) {
    return { averageScore: null, letterGrade: null, level: null, gradeCount: 0, lastScore: null, trend: null };
  }
  const lastScore = scoresNewestFirst[0];
  const previousAverage = roundedMean(scoresNewestFirst.slice(1));
  return {
    averageScore,
    letterGrade: letterGradeFor(averageScore),
    level: levelFor(averageScore),
    gradeCount: scoresNewestFirst.length,
    lastScore,
    trend: previousAverage === null ? null : lastScore - previousAverage,
  };
}

/** gradedAt azalan; eşitlikte ders başlığı (tr) artan, son çare ders kimliği. */
export function sortNewestFirst<T extends { gradedAt: Date; lessonTitle: string; lessonId: string }>(
  entries: readonly T[],
): T[] {
  return [...entries].sort(
    (a, b) =>
      b.gradedAt.getTime() - a.gradedAt.getTime() ||
      a.lessonTitle.localeCompare(b.lessonTitle, 'tr') ||
      a.lessonId.localeCompare(b.lessonId),
  );
}

export interface RosterStudent {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface RosterGradeInput {
  userId: string;
  score: number;
  gradedAt: Date;
}

export interface RosterEntry {
  student: RosterStudent;
  score: number | null;
  gradedAt: string | null;
}

/**
 * Kursa kayıtlı HER öğrenci için bir satır üretir (notu olmayanlar için score/gradedAt null),
 * ada göre (tr) sıralar. Kayıtlı olmayan kullanıcıların notları listeye girmez.
 */
export function buildRoster(students: readonly RosterStudent[], grades: readonly RosterGradeInput[]): RosterEntry[] {
  const byUser = new Map(grades.map((grade) => [grade.userId, grade]));
  return [...students]
    .sort((a, b) => a.name.localeCompare(b.name, 'tr') || a.email.localeCompare(b.email))
    .map((student) => {
      const grade = byUser.get(student.id);
      return {
        student: { id: student.id, name: student.name, email: student.email, avatarUrl: student.avatarUrl },
        score: grade ? grade.score : null,
        gradedAt: grade ? grade.gradedAt.toISOString() : null,
      };
    });
}

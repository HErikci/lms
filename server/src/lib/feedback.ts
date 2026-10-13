/** Ders geri bildirimi (beğeni + puan) için saf yardımcılar. */

export interface FeedbackGroup {
  liked: boolean;
  /** Gruptaki satır sayısı. */
  rows: number;
  /** Gruptaki puanı olan satır sayısı. */
  ratingCount: number;
  /** Gruptaki puanların toplamı (puan yoksa null/0). */
  ratingSum: number | null;
}

export interface FeedbackSummary {
  likeCount: number;
  ratingCount: number;
  ratingAverage: number | null;
}

/** Ortalamayı 1 ondalığa yuvarlar; puan yoksa null. */
export function roundAverage(sum: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.round((sum / count) * 10) / 10;
}

export function summarizeGroups(groups: FeedbackGroup[]): FeedbackSummary {
  let likeCount = 0;
  let ratingCount = 0;
  let ratingSum = 0;
  for (const g of groups) {
    if (g.liked) likeCount += g.rows;
    ratingCount += g.ratingCount;
    ratingSum += g.ratingSum ?? 0;
  }
  return { likeCount, ratingCount, ratingAverage: roundAverage(ratingSum, ratingCount) };
}

export interface FeedbackPatch {
  liked?: boolean;
  /** null = puanı kaldır. */
  rating?: number | null;
}

/** Gövdeyi doğrular; geçersizse hata mesajı döner. */
export function parseFeedbackBody(
  body: unknown,
): { ok: true; patch: FeedbackPatch } | { ok: false; message: string } {
  const missing = { ok: false as const, message: 'liked veya rating alanlarından en az biri gönderilmelidir.' };
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return missing;
  const raw = body as Record<string, unknown>;
  const patch: FeedbackPatch = {};
  if (raw.liked !== undefined) {
    if (typeof raw.liked !== 'boolean') return { ok: false, message: 'liked bir boolean olmalıdır.' };
    patch.liked = raw.liked;
  }
  if (raw.rating !== undefined) {
    const r = raw.rating;
    if (r !== null && !(typeof r === 'number' && Number.isInteger(r) && r >= 1 && r <= 5)) {
      return { ok: false, message: 'rating 1 ile 5 arasında bir tam sayı veya null olmalıdır.' };
    }
    patch.rating = r as number | null;
  }
  if (patch.liked === undefined && patch.rating === undefined) return missing;
  return { ok: true, patch };
}

/** Mevcut satırla yama birleştirir; gönderilmeyen alanlar korunur. */
export function mergeFeedback(
  existing: { liked: boolean; rating: number | null } | null,
  patch: FeedbackPatch,
): { liked: boolean; rating: number | null } {
  return {
    liked: patch.liked ?? existing?.liked ?? false,
    rating: patch.rating !== undefined ? patch.rating : (existing?.rating ?? null),
  };
}

import { apiFetch, ApiError } from '../../lib/apiClient';

/**
 * Öğrenciyi bir kursa kaydeder: POST /api/v1/courses/:id/enroll
 *
 * İstek idempotent kabul edilir: kullanıcı zaten kayıtlıysa backend
 * ALREADY_ENROLLED (409) döndürebilir; bu durum hata olarak değil,
 * başarı olarak ele alınır.
 */
export async function enrollInCourse(courseId: string): Promise<void> {
  try {
    await apiFetch(`/api/v1/courses/${courseId}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ method: 'OPEN' }),
    });
  } catch (err) {
    if (err instanceof ApiError && err.code === 'ALREADY_ENROLLED') {
      return;
    }
    throw err;
  }
}

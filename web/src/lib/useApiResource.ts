import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './apiClient';

/**
 * Tek bir GET kaynağını yükler. `path` null ise istek atılmaz. `setData` ile değişiklik
 * yanıtları (ör. PATCH'in döndürdüğü güncel nesne) yeniden yüklemeden yerine konabilir.
 * Yol değiştiğinde önceki isteğin geç gelen yanıtı yok sayılır.
 */
export function useApiResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<T>(path)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Veriler yüklenemedi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { data, setData, loading, error, reload };
}

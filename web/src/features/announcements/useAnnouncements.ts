import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/apiClient';
import type { AnnouncementCategory, AnnouncementItem } from '../../types';

export interface AnnouncementPayload {
  title: string;
  body: string;
  category: AnnouncementCategory;
  status: 'DRAFT' | 'PUBLISHED';
  /** ISO 8601; null = (yayınlanırken) hemen. */
  publishAt: string | null;
  expiresAt: string | null;
  pinned: boolean;
  courseId: string | null;
}

interface ListState {
  announcements: AnnouncementItem[];
  loading: boolean;
  error: string | null;
}

function useAnnouncementList(path: string) {
  const [state, setState] = useState<ListState>({ announcements: [], loading: true, error: null });

  const load = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    return apiFetch<{ announcements: AnnouncementItem[] }>(path)
      .then((result) => setState({ announcements: result.announcements, loading: false, error: null }))
      .catch((err) =>
        setState({
          announcements: [],
          loading: false,
          error: err instanceof Error ? err.message : 'Duyurular yüklenemedi.',
        }),
      );
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}

/** Okuyucu akışı: GET /api/v1/announcements (yalnızca yayında olanlar, sabitlenenler önce). */
export function useAnnouncements(options: { category?: AnnouncementCategory; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (options.category) params.set('category', options.category);
  if (options.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  return useAnnouncementList(`/api/v1/announcements${query ? `?${query}` : ''}`);
}

/** Yönetim listesi: GET /api/v1/announcements/manage (tüm durumlar, düzenlenebilir olanlar). */
export function useManagedAnnouncements() {
  return useAnnouncementList('/api/v1/announcements/manage');
}

/** Tek duyuru: GET /api/v1/announcements/:id. Görünmüyorsa API 404 döner. */
export function useAnnouncement(id: string | undefined) {
  const [announcement, setAnnouncement] = useState<AnnouncementItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<{ announcement: AnnouncementItem }>(`/api/v1/announcements/${id}`)
      .then((result) => {
        if (!cancelled) setAnnouncement(result.announcement);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Duyuru yüklenemedi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { announcement, loading, error };
}

export async function createAnnouncement(payload: AnnouncementPayload): Promise<AnnouncementItem> {
  const result = await apiFetch<{ announcement: AnnouncementItem }>('/api/v1/announcements', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result.announcement;
}

export async function updateAnnouncement(
  id: string,
  payload: Partial<AnnouncementPayload>,
): Promise<AnnouncementItem> {
  const result = await apiFetch<{ announcement: AnnouncementItem }>(`/api/v1/announcements/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return result.announcement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await apiFetch<{ deleted: boolean }>(`/api/v1/announcements/${id}`, { method: 'DELETE' });
}

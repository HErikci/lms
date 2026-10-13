import { useCallback } from 'react';
import type { EventInput, EventSourceFunc } from '@fullcalendar/core';
import { apiFetch } from '../../lib/apiClient';
import type { CalendarEvent, CalendarEventType } from '../../types';
import { EVENT_TYPES } from './eventTypes';

export interface CalendarEventPayload {
  title: string;
  type: CalendarEventType;
  start: string;
  end: string | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
  courseId: string | null;
}

export async function fetchCalendarEvents(fromIso: string, toIso: string): Promise<CalendarEvent[]> {
  const query = new URLSearchParams({ from: fromIso, to: toIso });
  const result = await apiFetch<{ events: CalendarEvent[] }>(`/api/v1/calendar/events?${query}`);
  return result.events;
}

/** POST gövdesinde boş (null) alanlar çıkarılır; courseId null "genel" anlamına gelir. */
export async function createCalendarEvent(payload: CalendarEventPayload): Promise<CalendarEvent> {
  const body: Record<string, unknown> = { courseId: payload.courseId };
  (Object.keys(payload) as (keyof CalendarEventPayload)[]).forEach((key) => {
    if (key !== 'courseId' && payload[key] !== null) body[key] = payload[key];
  });
  const result = await apiFetch<{ event: CalendarEvent }>('/api/v1/calendar/events', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return result.event;
}

export async function updateCalendarEvent(
  id: string,
  payload: Partial<CalendarEventPayload>,
): Promise<CalendarEvent> {
  const result = await apiFetch<{ event: CalendarEvent }>(`/api/v1/calendar/events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return result.event;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await apiFetch<{ deleted: boolean }>(`/api/v1/calendar/events/${id}`, { method: 'DELETE' });
}

/**
 * Takvim etkinliklerinin tek giriş noktası: FullCalendar'ın `events` fonksiyon kaynağı için
 * görünür aralığa göre GET isteği yapar. Mutasyon sonrası yenileme için
 * AcademicCalendar'ın `refetch()` metodu kullanılır.
 */
export function useCalendarEvents(editable: boolean): EventSourceFunc {
  return useCallback<EventSourceFunc>(
    (info, success, failure) => {
      fetchCalendarEvents(info.start.toISOString(), info.end.toISOString())
        .then((events) => success(events.map((event) => toEventInput(event, editable))))
        .catch((err) => failure(err instanceof Error ? err : new Error('Etkinlikler yüklenemedi.')));
    },
    [editable],
  );
}

export function toEventInput(event: CalendarEvent, editable: boolean): EventInput {
  const meta = EVENT_TYPES[event.type];
  return {
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end ?? undefined,
    allDay: event.allDay,
    // Etkinlik düzeyindeki `editable` takvim düzeyini ezdiğinden salt okunur modda da burada kapatılır.
    editable: editable && event.canEdit,
    backgroundColor: meta.background,
    borderColor: meta.background,
    textColor: meta.text,
    extendedProps: { source: event },
  };
}

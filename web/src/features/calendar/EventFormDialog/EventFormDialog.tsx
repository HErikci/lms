import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button, Text } from '../../../components';
import type { CalendarEventType } from '../../../types';
import { EVENT_TYPE_KEYS, EVENT_TYPES } from '../eventTypes';
import { addDaysToDateInput } from '../dateUtils';
import type { CalendarEventPayload } from '../useCalendarEvents';
import styles from './EventFormDialog.module.css';

export interface CourseOption {
  id: string;
  title: string;
}

/**
 * Form başlangıç değerleri. Tarih alanları yerel değerlerdir: tüm gün için "YYYY-MM-DD"
 * (bitiş DAHİL gösterilir), zamanlı için "YYYY-MM-DDTHH:mm".
 */
export interface EventFormInitial {
  title: string;
  type: CalendarEventType;
  courseId: string | null;
  allDay: boolean;
  start: string;
  end: string;
  location: string;
  description: string;
}

interface EventFormDialogProps {
  mode: 'create' | 'edit';
  initial: EventFormInitial;
  /** Seçilebilir kurslar. */
  courses: CourseOption[];
  /** Yalnızca ADMIN "Genel" etkinlik oluşturabilir. */
  canCreateGeneral: boolean;
  onSave: (payload: CalendarEventPayload) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function EventFormDialog({
  mode,
  initial,
  courses,
  canCreateGeneral,
  onSave,
  onDelete,
  onClose,
}: EventFormDialogProps) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initial.title);
  const [type, setType] = useState<CalendarEventType>(initial.type);
  const [courseId, setCourseId] = useState(initial.courseId ?? '');
  const [allDay, setAllDay] = useState(initial.allDay);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [location, setLocation] = useState(initial.location);
  const [description, setDescription] = useState(initial.description);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // İlk odak başlıkta; kapanınca odak önceki öğeye döner.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    titleRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!busy) onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!nodes || nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const toggleAllDay = (next: boolean) => {
    // Alan türü değişirken değerleri karşılık gelen biçime dönüştür.
    const toDate = (value: string) => value.slice(0, 10);
    if (next) {
      setStart(toDate(start));
      setEnd(end ? toDate(end) : '');
    } else {
      setStart(start ? `${toDate(start)}T09:00` : '');
      setEnd(end ? `${toDate(end)}T10:00` : '');
    }
    setAllDay(next);
  };

  const buildPayload = (): CalendarEventPayload | string => {
    if (!title.trim()) return 'Başlık zorunludur.';
    if (!start) return 'Başlangıç zorunludur.';
    if (!canCreateGeneral && !courseId) return 'Bir kurs seçmelisiniz.';

    let startValue: string;
    let endValue: string | null = null;
    if (allDay) {
      if (end && end < start) return 'Bitiş, başlangıçtan önce olamaz.';
      startValue = start;
      endValue = end ? addDaysToDateInput(end, 1) : null; // API'de bitiş günü hariçtir
    } else {
      const startDate = new Date(start);
      if (Number.isNaN(startDate.getTime())) return 'Başlangıç geçersiz.';
      startValue = startDate.toISOString();
      if (end) {
        const endDate = new Date(end);
        if (Number.isNaN(endDate.getTime())) return 'Bitiş geçersiz.';
        if (endDate <= startDate) return 'Bitiş, başlangıçtan sonra olmalıdır.';
        endValue = endDate.toISOString();
      }
    }

    return {
      title: title.trim(),
      type,
      start: startValue,
      end: endValue,
      allDay,
      location: location.trim() || null,
      description: description.trim() || null,
      courseId: courseId || null,
    };
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem tamamlanamadı.');
      setBusy(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = buildPayload();
    if (typeof payload === 'string') {
      setError(payload);
      return;
    }
    void run(() => onSave(payload));
  };

  const dateType = allDay ? 'date' : 'datetime-local';

  return createPortal(
    <div
      className={styles.scrim}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onKeyDown={handleKeyDown}
      >
        <Text role="headline-sm" as="h2" className={styles.title}>
          <span id={headingId}>{mode === 'create' ? 'Yeni Etkinlik' : 'Etkinliği Düzenle'}</span>
        </Text>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.field}>
            <Text role="label-md" as="span" tone="muted">
              Başlık
            </Text>
            <input
              ref={titleRef}
              className={styles.input}
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              aria-required="true"
            />
          </label>

          <div className={styles.row}>
            <label className={styles.field}>
              <Text role="label-md" as="span" tone="muted">
                Tür
              </Text>
              <select
                className={styles.input}
                value={type}
                onChange={(event) => setType(event.target.value as CalendarEventType)}
              >
                {EVENT_TYPE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {EVENT_TYPES[key].label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <Text role="label-md" as="span" tone="muted">
                Kurs
              </Text>
              <select
                className={styles.input}
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
              >
                {canCreateGeneral && <option value="">Genel (tüm kullanıcılar)</option>}
                {!canCreateGeneral && !courseId && <option value="">Kurs seçin</option>}
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={styles.checkbox}>
            <input type="checkbox" checked={allDay} onChange={(event) => toggleAllDay(event.target.checked)} />
            <Text role="body-md" as="span">
              Tüm gün
            </Text>
          </label>

          <div className={styles.row}>
            <label className={styles.field}>
              <Text role="label-md" as="span" tone="muted">
                Başlangıç
              </Text>
              <input
                className={styles.input}
                type={dateType}
                value={start}
                onChange={(event) => setStart(event.target.value)}
                required
                aria-required="true"
              />
            </label>
            <label className={styles.field}>
              <Text role="label-md" as="span" tone="muted">
                Bitiş
              </Text>
              <input
                className={styles.input}
                type={dateType}
                value={end}
                min={start || undefined}
                onChange={(event) => setEnd(event.target.value)}
              />
            </label>
          </div>

          <label className={styles.field}>
            <Text role="label-md" as="span" tone="muted">
              Yer
            </Text>
            <input
              className={styles.input}
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </label>

          <label className={styles.field}>
            <Text role="label-md" as="span" tone="muted">
              Açıklama
            </Text>
            <textarea
              className={styles.textarea}
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          {error && (
            <div className={styles.error} role="alert">
              <Text role="body-sm" tone="error" as="p">
                {error}
              </Text>
            </div>
          )}

          {confirmingDelete ? (
            <div className={styles.actions} role="group" aria-label="Silme onayı">
              <Text role="body-md" as="p" className={styles.spacer}>
                Bu etkinlik kalıcı olarak silinsin mi?
              </Text>
              <Button variant="ghost" disabled={busy} onClick={() => setConfirmingDelete(false)}>
                Vazgeç
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => onDelete && void run(onDelete)}
              >
                Evet, Sil
              </Button>
            </div>
          ) : (
            <div className={styles.actions}>
              {mode === 'edit' && onDelete && (
                <Button
                  variant="destructive"
                  iconStart="delete"
                  className={styles.spacer}
                  disabled={busy}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Sil
                </Button>
              )}
              <Button variant="ghost" disabled={busy} onClick={onClose}>
                İptal
              </Button>
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>,
    document.body,
  );
}

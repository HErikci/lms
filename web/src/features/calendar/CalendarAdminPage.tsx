import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Text } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import { useCurrentUser } from '../../data/useCurrentUser';
import type { CalendarEvent } from '../../types';
import { AcademicCalendar } from './AcademicCalendar';
import type { AcademicCalendarHandle, CalendarSelection } from './AcademicCalendar';
import { EventFormDialog } from './EventFormDialog';
import type { EventFormInitial } from './EventFormDialog';
import { addDaysToDateInput, parseEventDate, toDateInput, toDateTimeInput } from './dateUtils';
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from './useCalendarEvents';
import type { CalendarEventPayload } from './useCalendarEvents';
import { useEventCourses } from './useEventCourses';
import styles from './CalendarPage.module.css';

interface DialogState {
  mode: 'create' | 'edit';
  eventId?: string;
  initial: EventFormInitial;
}

function blankInitial(overrides: Partial<EventFormInitial>): EventFormInitial {
  return {
    title: '',
    type: 'event',
    courseId: null,
    allDay: false,
    start: '',
    end: '',
    location: '',
    description: '',
    ...overrides,
  };
}

/** Takvimde seçilen aralığı form değerlerine çevirir (tüm gün bitişi dahil gösterilir). */
function initialFromSelection(selection: CalendarSelection): Partial<EventFormInitial> {
  if (selection.allDay) {
    const start = toDateInput(selection.start);
    const lastDay = addDaysToDateInput(toDateInput(selection.end), -1);
    return { allDay: true, start, end: lastDay > start ? lastDay : '' };
  }
  return {
    allDay: false,
    start: toDateTimeInput(selection.start),
    end: toDateTimeInput(selection.end),
  };
}

function initialFromEvent(event: CalendarEvent): EventFormInitial {
  let start: string;
  let end = '';
  if (event.allDay) {
    start = event.start.slice(0, 10);
    if (event.end) {
      const lastDay = addDaysToDateInput(event.end.slice(0, 10), -1);
      end = lastDay > start ? lastDay : '';
    }
  } else {
    start = toDateTimeInput(parseEventDate(event.start));
    end = event.end ? toDateTimeInput(parseEventDate(event.end)) : '';
  }
  return {
    title: event.title,
    type: event.type,
    courseId: event.course?.id ?? null,
    allDay: event.allDay,
    start,
    end,
    location: event.location ?? '',
    description: event.description ?? '',
  };
}

export function CalendarAdminPage() {
  const { user } = useCurrentUser();
  const courses = useEventCourses(user);
  const calendarRef = useRef<AcademicCalendarHandle>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  // Düzenlenen etkinliğin kursu listede yoksa seçenek olarak eklenir.
  const [extraCourse, setExtraCourse] = useState<{ id: string; title: string } | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const defaultCourseId = isAdmin ? null : (courses[0]?.id ?? null);

  const courseOptions = useMemo(
    () =>
      extraCourse && !courses.some((course) => course.id === extraCourse.id)
        ? [...courses, extraCourse]
        : courses,
    [courses, extraCourse],
  );

  const openCreate = (overrides: Partial<EventFormInitial> = {}) => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const later = new Date(now.getTime() + 60 * 60 * 1000);
    setExtraCourse(null);
    setDialog({
      mode: 'create',
      initial: blankInitial({
        courseId: defaultCourseId,
        start: toDateTimeInput(now),
        end: toDateTimeInput(later),
        ...overrides,
      }),
    });
  };

  const handleSelect = (selection: CalendarSelection) => openCreate(initialFromSelection(selection));

  const handleEventClick = (event: CalendarEvent) => {
    if (!event.canEdit) return;
    setExtraCourse(event.course);
    setDialog({ mode: 'edit', eventId: event.id, initial: initialFromEvent(event) });
  };

  const close = () => setDialog(null);

  const handleSave = async (payload: CalendarEventPayload) => {
    if (!dialog) return;
    if (dialog.mode === 'create') await createCalendarEvent(payload);
    else if (dialog.eventId) await updateCalendarEvent(dialog.eventId, payload);
    close();
    calendarRef.current?.refetch();
  };

  const handleDelete = async () => {
    if (!dialog?.eventId) return;
    await deleteCalendarEvent(dialog.eventId);
    close();
    calendarRef.current?.refetch();
  };

  return (
    <PageContainer>
      <div className={styles.header}>
        <div>
          <Text role="headline-lg" as="h1">
            Takvim Yönetimi
          </Text>
          <Text role="body-md" tone="muted" as="p">
            Boş bir alanı seçerek yeni etkinlik ekleyin; etkinliği tıklayarak düzenleyin veya sürükleyerek taşıyın.
          </Text>
        </div>
        <div className={styles.headerActions}>
          <Link to="/takvim" className={styles.manageLink}>
            Öğrenci görünümü
          </Link>
          <Button variant="primary" iconStart="add" onClick={() => openCreate()}>
            Yeni Etkinlik
          </Button>
        </div>
      </div>

      <AcademicCalendar
        ref={calendarRef}
        editable
        onEventClick={handleEventClick}
        onSelectRange={handleSelect}
      />

      {dialog && (
        <EventFormDialog
          mode={dialog.mode}
          initial={dialog.initial}
          courses={courseOptions}
          canCreateGeneral={isAdmin}
          onSave={handleSave}
          onDelete={dialog.mode === 'edit' ? handleDelete : undefined}
          onClose={close}
        />
      )}
    </PageContainer>
  );
}

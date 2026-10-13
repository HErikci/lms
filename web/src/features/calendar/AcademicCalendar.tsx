import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import trLocale from '@fullcalendar/core/locales/tr';
import type {
  DayHeaderContentArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventSourceFunc,
  ToolbarInput,
} from '@fullcalendar/core';
import { Card, Text } from '../../components';
import type { CalendarEvent } from '../../types';
import { EVENT_TYPES } from './eventTypes';
import { toDateInput } from './dateUtils';
import { updateCalendarEvent, useCalendarEvents } from './useCalendarEvents';
import { useIsNarrow } from './useIsNarrow';
import styles from './CalendarPage.module.css';

export interface CalendarSelection {
  start: Date;
  /** Tüm gün seçimlerinde bitiş günü hariçtir. */
  end: Date;
  allDay: boolean;
}

export interface AcademicCalendarHandle {
  refetch: () => void;
}

interface AcademicCalendarProps {
  /** true: aralık seçme, sürükle/yeniden boyutlandır (yalnızca canEdit olan etkinlikler). */
  editable: boolean;
  onEventClick: (event: CalendarEvent) => void;
  onSelectRange?: (selection: CalendarSelection) => void;
}

const WIDE_TOOLBAR: ToolbarInput = {
  left: 'prev,next today',
  center: 'title',
  right: 'timeGridWeek,timeGridDay,dayGridMonth,listWeek',
};

const NARROW_TOOLBAR: ToolbarInput = {
  left: 'prev,next',
  center: 'title',
  right: 'today',
};

const NARROW_FOOTER: ToolbarInput = { center: 'listWeek,timeGridDay,dayGridMonth' };

const TIME_FORMAT = { hour: '2-digit', minute: '2-digit', hour12: false } as const;

const READ_PLUGINS = [timeGridPlugin, dayGridPlugin, listPlugin];
const EDIT_PLUGINS = [...READ_PLUGINS, interactionPlugin];

/** Haftalık/günlük görünümde gün başlığı: "PZT" + büyük gün numarası, bugün daire içinde. */
function renderDayHeader(arg: DayHeaderContentArg) {
  if (!arg.view.type.startsWith('timeGrid')) return arg.text;
  const weekday = arg.date.toLocaleDateString('tr-TR', { weekday: 'short' }).toLocaleUpperCase('tr-TR');
  return (
    <span className={styles.dayHead}>
      <span className={[styles.dayName, arg.isToday ? styles.dayNameToday : null].filter(Boolean).join(' ')}>
        {weekday}
      </span>
      <span className={[styles.dayNumber, arg.isToday ? styles.dayNumberToday : null].filter(Boolean).join(' ')}>
        {arg.date.getDate()}
      </span>
    </span>
  );
}

function renderEventContent(arg: EventContentArg) {
  const source = arg.event.extendedProps.source as CalendarEvent;
  const meta = [arg.timeText, source.location].filter(Boolean).join(', ');
  return (
    <span className={styles.eventBody}>
      <span className={styles.eventTitle}>{arg.event.title}</span>
      {meta && <span className={styles.eventMeta}>{meta}</span>}
    </span>
  );
}

export const AcademicCalendar = forwardRef<AcademicCalendarHandle, AcademicCalendarProps>(
  function AcademicCalendar({ editable, onEventClick, onSelectRange }, ref) {
    const isNarrow = useIsNarrow();
    const calendarRef = useRef<FullCalendar>(null);
    const source = useCalendarEvents(editable);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [moveError, setMoveError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({ refetch: () => calendarRef.current?.getApi().refetchEvents() }), []);

    const events = useCallback<EventSourceFunc>(
      (info, success, failure) => {
        source(
          info,
          (list) => {
            setLoadError(null);
            success(list);
          },
          (error) => {
            setLoadError(error.message || 'Etkinlikler yüklenemedi.');
            failure(error);
          },
        );
      },
      [source],
    );

    // Dar ekranda haftalık ızgara sıkışır; varsayılanı ajanda (liste) görünümüne çevir.
    useEffect(() => {
      const api = calendarRef.current?.getApi();
      if (!api) return;
      const view = api.view.type;
      if (isNarrow && view === 'timeGridWeek') api.changeView('listWeek');
      if (!isNarrow && view === 'listWeek') api.changeView('timeGridWeek');
    }, [isNarrow]);

    const handleEventClick = (arg: EventClickArg) => {
      arg.jsEvent.preventDefault();
      onEventClick(arg.event.extendedProps.source as CalendarEvent);
    };

    // Sürükle/boyutlandır: sunucuya PATCH; hata olursa etkinlik eski yerine döner.
    const persistMove = async (arg: EventDropArg | EventResizeDoneArg) => {
      const { event } = arg;
      if (!event.start) {
        arg.revert();
        return;
      }
      setMoveError(null);
      const allDay = event.allDay;
      try {
        await updateCalendarEvent(event.id, {
          allDay,
          start: allDay ? toDateInput(event.start) : event.start.toISOString(),
          end: event.end ? (allDay ? toDateInput(event.end) : event.end.toISOString()) : null,
        });
        calendarRef.current?.getApi().refetchEvents();
      } catch (err) {
        arg.revert();
        setMoveError(err instanceof Error ? err.message : 'Etkinlik güncellenemedi.');
      }
    };

    const statusError = loadError ?? moveError;

    return (
      <>
        <ul className={styles.legend} aria-label="Etkinlik türleri">
          {Object.entries(EVENT_TYPES).map(([type, meta]) => (
            <li key={type} className={styles.legendItem}>
              <span className={styles.swatch} style={{ backgroundColor: meta.background }} aria-hidden="true" />
              <Text role="body-sm" tone="muted">
                {meta.label}
              </Text>
            </li>
          ))}
        </ul>

        <div className={styles.status}>
          {statusError ? (
            <div role="alert">
              <Text role="body-sm" tone="error" as="p">
                {statusError}
              </Text>
            </div>
          ) : (
            <div role="status">
              {loading && (
                <Text role="body-sm" tone="muted" as="p">
                  Etkinlikler yükleniyor…
                </Text>
              )}
            </div>
          )}
        </div>

        <Card padding="md" className={styles.calendar}>
          <FullCalendar
            ref={calendarRef}
            plugins={editable ? EDIT_PLUGINS : READ_PLUGINS}
            locale={trLocale}
            firstDay={1}
            buttonText={{ today: 'Bugün', week: 'Hafta', day: 'Gün', month: 'Ay', list: 'Ajanda' }}
            initialView={isNarrow ? 'listWeek' : 'timeGridWeek'}
            headerToolbar={isNarrow ? NARROW_TOOLBAR : WIDE_TOOLBAR}
            footerToolbar={isNarrow ? NARROW_FOOTER : false}
            height="auto"
            events={events}
            loading={setLoading}
            allDayText="Tüm gün"
            slotMinTime="07:00:00"
            slotMaxTime="24:00:00"
            scrollTime="08:00:00"
            slotLabelFormat={TIME_FORMAT}
            eventTimeFormat={TIME_FORMAT}
            nowIndicator
            eventInteractive
            eventDisplay="block"
            dayMaxEvents
            noEventsText="Bu aralıkta etkinlik yok."
            dayHeaderContent={renderDayHeader}
            eventContent={renderEventContent}
            eventClassNames={styles.event}
            eventClick={handleEventClick}
            editable={editable}
            selectable={editable}
            selectMirror={editable}
            select={
              editable
                ? (arg) => {
                    calendarRef.current?.getApi().unselect();
                    onSelectRange?.({ start: arg.start, end: arg.end, allDay: arg.allDay });
                  }
                : undefined
            }
            eventDrop={editable ? persistMove : undefined}
            eventResize={editable ? persistMove : undefined}
          />
        </Card>
      </>
    );
  },
);

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, Icon, IconButton, Text } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import { useCurrentUser } from '../../data/useCurrentUser';
import type { CalendarEvent } from '../../types';
import { AcademicCalendar } from './AcademicCalendar';
import { EVENT_TYPES } from './eventTypes';
import { parseEventDate } from './dateUtils';
import styles from './CalendarPage.module.css';

function formatRange(event: CalendarEvent): string {
  const start = parseEventDate(event.start);
  const dateFormat: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', weekday: 'long' };
  if (event.allDay) {
    if (!event.end) return start.toLocaleDateString('tr-TR', dateFormat);
    const lastDay = parseEventDate(event.end);
    lastDay.setDate(lastDay.getDate() - 1); // bitiş günü hariç tutulur
    return `${start.toLocaleDateString('tr-TR', dateFormat)} – ${lastDay.toLocaleDateString('tr-TR', dateFormat)}`;
  }
  const time = (date: Date) => date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const end = event.end ? parseEventDate(event.end) : null;
  return `${start.toLocaleDateString('tr-TR', dateFormat)}, ${time(start)}${end ? ` – ${time(end)}` : ''}`;
}

export function CalendarPage() {
  const { user } = useCurrentUser();
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const canManage = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';

  // Ayrıntı kartı takvimin altında açılır; seçilince görünür alana getir.
  useEffect(() => {
    if (!selected) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    detailsRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  }, [selected]);

  return (
    <PageContainer>
      <div className={styles.header}>
        <div>
          <Text role="headline-lg" as="h1">
            Akademik Takvim
          </Text>
          <Text role="body-md" tone="muted" as="p">
            Canlı dersler, laboratuvarlar, sınavlar ve son teslim tarihleri
          </Text>
        </div>
        {canManage && (
          <Link to="/yonetim/takvim" className={styles.manageLink}>
            <Icon name="edit_calendar" size="md" />
            Takvimi Yönet
          </Link>
        )}
      </div>

      <AcademicCalendar editable={false} onEventClick={setSelected} />

      {selected && (
        <div ref={detailsRef}>
          <Card padding="lg" className={styles.details}>
            <div className={styles.detailsHeader}>
              <span className={styles.detailsTitle}>
                <Icon name={EVENT_TYPES[selected.type].icon} size="lg" filled />
                <Text role="title-md" as="h2" tone="main">
                  {selected.title}
                </Text>
              </span>
              <IconButton icon="close" label="Ayrıntıları kapat" onClick={() => setSelected(null)} />
            </div>
            <span className={styles.detailsBadge}>
              <Badge tone={EVENT_TYPES[selected.type].tone} variant="soft">
                {EVENT_TYPES[selected.type].label}
              </Badge>
            </span>
            <dl className={styles.detailsList}>
              <dt>Zaman</dt>
              <dd>{formatRange(selected)}</dd>
              {selected.course && (
                <>
                  <dt>Kurs</dt>
                  <dd>{selected.course.title}</dd>
                </>
              )}
              {selected.location && (
                <>
                  <dt>Yer</dt>
                  <dd>{selected.location}</dd>
                </>
              )}
              {selected.description && (
                <>
                  <dt>Açıklama</dt>
                  <dd>{selected.description}</dd>
                </>
              )}
            </dl>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}

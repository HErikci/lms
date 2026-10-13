import { Badge, Card, Icon, Text } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import styles from './CalendarPage.module.css';

interface Event {
  date: string;
  type: 'exam' | 'deadline' | 'lecture' | 'holiday';
  title: string;
  details: string;
}

const events: Event[] = [
  { date: '20 Ekim', type: 'lecture', title: 'Canlı Ders: Veri Yapıları', details: 'CENG 201 - Pazartesi 10:00' },
  { date: '22 Ekim', type: 'deadline', title: 'Ödev Teslimi', details: 'SWE 212 - Perşembe 23:59' },
  { date: '25 Ekim', type: 'exam', title: 'Quiz: İkili Arama Ağaçları', details: 'CENG 201 - Çevrim içi 15 dakika' },
  { date: '27 Ekim', type: 'deadline', title: 'Proje Ödevi 2 Teslimi', details: 'CENG 201 - Cuma 23:59' },
  { date: '30 Ekim', type: 'exam', title: 'SQL Ara Sınavı', details: 'SWE 212 - Çevrim içi 45 dakika' },
  { date: '2 Kasım', type: 'holiday', title: 'Kurtuluş Günü Tatili', details: 'Resmi tatil' },
];

function getEventTone(type: Event['type']) {
  switch (type) {
    case 'exam':
      return 'error' as const;
    case 'deadline':
      return 'warning' as const;
    case 'lecture':
      return 'cyan' as const;
    case 'holiday':
      return 'success' as const;
  }
}

function getEventIcon(type: Event['type']) {
  switch (type) {
    case 'exam':
      return 'quiz';
    case 'deadline':
      return 'assignment';
    case 'lecture':
      return 'video_call';
    case 'holiday':
      return 'celebration';
  }
}

export function CalendarPage() {
  return (
    <PageContainer>
      <div className={styles.header}>
        <Text role="headline-lg" as="h1">
          Akademik Takvim
        </Text>
        <Text role="body-md" tone="muted" as="p">
          Güz 2024 — Sınavlar, ödevler ve canlı dersler
        </Text>
      </div>

      <div className={styles.timeline}>
        {events.map((event, idx) => (
          <div key={idx} className={styles.event}>
            <div className={styles.dateBar}>
              <Text role="label-md" weight="bold">
                {event.date}
              </Text>
              <div className={styles.line} />
            </div>

            <Card padding="lg" elevation="1">
              <div className={styles.eventContent}>
                <div className={styles.eventIcon}>
                  <Icon name={getEventIcon(event.type)} size="lg" filled />
                </div>
                <div className={styles.eventText}>
                  <Text role="title-md" as="h3">
                    {event.title}
                  </Text>
                  <Text role="body-sm" tone="muted">
                    {event.details}
                  </Text>
                </div>
                <Badge tone={getEventTone(event.type)} variant="soft">
                  {event.type === 'exam'
                    ? 'Sınav'
                    : event.type === 'deadline'
                      ? 'Teslim'
                      : event.type === 'lecture'
                        ? 'Ders'
                        : 'Tatil'}
                </Badge>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}

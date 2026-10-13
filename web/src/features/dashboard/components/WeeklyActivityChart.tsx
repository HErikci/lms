import { Card, Text } from '../../../components';
import type { ActivityDay } from '../../../types';
import styles from './WeeklyActivityChart.module.css';

interface WeeklyActivityChartProps {
  activity: ActivityDay[];
  loading?: boolean;
  error?: string | null;
}

const PLOT_HEIGHT_PX = 150;

/** 75 dk → "1 sa 15 dk", 45 dk → "45 dk". */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} dk`;
  return rest === 0 ? `${hours} sa` : `${hours} sa ${rest} dk`;
}

/** "2026-10-13" → "13 Ekim Salı"; yalnızca takvim günü okunur, saat dilimi kayması olmaması için UTC. */
function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    timeZone: 'UTC',
  });
}

/**
 * Yığılmış çubuk grafik. Ekseni ve ızgarası olmayan 7 çubuklu bir şerit olduğu için
 * SVG veya grafik kütüphanesi yerine düz div'lerle çiziliyor (mockup ile aynı yaklaşım).
 */
export function WeeklyActivityChart({ activity, loading = false, error = null }: WeeklyActivityChartProps) {
  const peak = Math.max(...activity.map((day) => day.videoMinutes + day.otherMinutes), 1);
  const toPx = (minutes: number) => Math.round((minutes / peak) * PLOT_HEIGHT_PX);
  const isEmpty = activity.every((day) => day.videoMinutes + day.otherMinutes === 0);

  const status = loading
    ? 'Yükleniyor…'
    : error
      ? error
      : isEmpty
        ? 'Son 7 günde kayıtlı çalışma yok. Bir derse girdiğinde süren burada görünür.'
        : null;

  return (
    <Card padding="md" className={styles.card}>
      <header className={styles.header}>
        <div className={styles.titles}>
          <Text role="headline-sm" as="h2" tone="navy" weight="bold">
            Haftalık Çalışma Aktivitesi
          </Text>
          <Text role="body-sm" as="p" tone="muted">
            Son 7 günlük ders çalışma ve video izleme dağılımı
          </Text>
        </div>

        <ul className={styles.legend}>
          <li className={styles.legendItem}>
            <span className={[styles.swatch, styles.swatchVideo].join(' ')} aria-hidden="true" />
            <Text role="body-sm" tone="muted">
              Video Dersler
            </Text>
          </li>
          <li className={styles.legendItem}>
            <span className={[styles.swatch, styles.swatchTask].join(' ')} aria-hidden="true" />
            <Text role="body-sm" tone="muted">
              Doküman & Quiz
            </Text>
          </li>
        </ul>
      </header>

      {status && (
        <Text role="body-sm" as="p" tone={error ? 'error' : 'muted'}>
          {status}
        </Text>
      )}

      {activity.length > 0 && (
        <ul className={styles.plot}>
          {activity.map((day, index) => {
            const total = day.videoMinutes + day.otherMinutes;

            return (
              <li key={day.date} className={styles.column} tabIndex={0}>
                <div
                  className={[
                    styles.tooltip,
                    index === 0 ? styles.tooltipStart : null,
                    index === activity.length - 1 ? styles.tooltipEnd : null,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-hidden="true"
                >
                  <span className={styles.tooltipDate}>{formatDate(day.date)}</span>
                  <span className={styles.tooltipTotal}>Toplam: {formatDuration(total)}</span>
                  <span className={styles.tooltipRow}>
                    <span className={[styles.swatch, styles.swatchVideo].join(' ')} />
                    Video: {formatDuration(day.videoMinutes)}
                  </span>
                  <span className={styles.tooltipRow}>
                    <span className={[styles.swatch, styles.swatchTask].join(' ')} />
                    Doküman & Quiz: {formatDuration(day.otherMinutes)}
                  </span>
                </div>
                <div className={styles.stack} style={{ height: `${PLOT_HEIGHT_PX}px` }}>
                  <span
                    className={[styles.segment, styles.task, day.isToday ? styles.glowTask : null]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ height: `${toPx(day.otherMinutes)}px` }}
                  />
                  <span
                    className={[styles.segment, styles.video, day.isToday ? styles.glowVideo : null]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ height: `${toPx(day.videoMinutes)}px` }}
                  />
                </div>
                <Text
                  role="body-sm"
                  tone={day.isToday ? 'secondary' : 'muted'}
                  weight={day.isToday ? 'bold' : 'normal'}
                >
                  {day.label}
                </Text>
                <span className={styles.visuallyHidden}>
                  {total} dakika (video {day.videoMinutes}, doküman ve quiz {day.otherMinutes})
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

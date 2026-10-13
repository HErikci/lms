import { Card, Text } from '../../../components';
import type { ActivityDay } from '../../../types';
import styles from './WeeklyActivityChart.module.css';

interface WeeklyActivityChartProps {
  activity: ActivityDay[];
}

const PLOT_HEIGHT_PX = 150;

/**
 * Yığılmış çubuk grafik. Ekseni ve ızgarası olmayan 7 çubuklu bir şerit olduğu için
 * SVG veya grafik kütüphanesi yerine düz div'lerle çiziliyor (mockup ile aynı yaklaşım).
 */
export function WeeklyActivityChart({ activity }: WeeklyActivityChartProps) {
  const peak = Math.max(...activity.map((day) => day.videoMinutes + day.taskMinutes), 1);
  const toPx = (minutes: number) => Math.round((minutes / peak) * PLOT_HEIGHT_PX);

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
              Quiz & Görevler
            </Text>
          </li>
        </ul>
      </header>

      <ul className={styles.plot}>
        {activity.map((day) => {
          const total = day.videoMinutes + day.taskMinutes;

          return (
            <li
              key={day.label}
              className={[styles.column, day.isWeekend ? styles.weekend : null]
                .filter(Boolean)
                .join(' ')}
            >
              <div
                className={styles.stack}
                title={`${day.label}: ${total} dk (video ${day.videoMinutes} dk, görev ${day.taskMinutes} dk)`}
              >
                <span
                  className={[styles.segment, styles.task, day.isToday ? styles.glowTask : null]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ height: `${toPx(day.taskMinutes)}px` }}
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
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

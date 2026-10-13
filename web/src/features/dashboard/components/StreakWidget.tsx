import { Text } from '../../../components';
import type { ActivityDay, TermInfo } from '../../../types';
import styles from './StreakWidget.module.css';

interface StreakWidgetProps {
  term: TermInfo;
  activity: ActivityDay[];
}

/** Hero içindeki seri sayacı ve haftalık hedef mini göstergesi. */
export function StreakWidget({ term, activity }: StreakWidgetProps) {
  const peak = Math.max(...activity.map((day) => day.videoMinutes + day.taskMinutes), 1);

  return (
    <div className={styles.widget}>
      <div className={styles.streak}>
        <Text role="headline-md" tone="on-primary" weight="bold">
          {term.streakDays}
        </Text>
        <Text role="label-md" tone="on-primary" className={styles.streakLabel}>
          Gün Seri
        </Text>
      </div>

      <div className={styles.goal}>
        <Text role="label-lg" tone="on-primary">
          Bu Haftaki Hedef: {term.weeklyGoalHours} Saat
        </Text>

        <ul className={styles.bars}>
          {activity.map((day) => {
            const total = day.videoMinutes + day.taskMinutes;
            const height = Math.max(20, Math.round((total / peak) * 100));
            const state = day.isToday ? styles.today : total > 0 ? styles.done : styles.pending;

            return (
              <li
                key={day.label}
                className={[styles.bar, state].join(' ')}
                style={{ height: `${height}%` }}
                title={`${day.label}: ${total} dk`}
              />
            );
          })}
        </ul>

        <Text role="body-sm" tone="on-primary" className={styles.todayNote}>
          Bugün {term.minutesCompletedToday} dk tamamlandı
        </Text>
      </div>
    </div>
  );
}

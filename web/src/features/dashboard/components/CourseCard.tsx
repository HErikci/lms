import { Badge, Button, Card, Icon, ProgressBar, Text } from '../../../components';
import type { Course } from '../../../types';
import styles from './CourseCard.module.css';

interface CourseCardProps {
  course: Course;
}

export function CourseCard({ course }: CourseCardProps) {
  return (
    <Card as="article" padding="none" interactive className={styles.card}>
      <div className={styles.media}>
        <img src={course.thumbnailUrl} alt={course.thumbnailAlt} className={styles.image} />
        <Badge tone="navy" variant="solid" shape="rounded" className={styles.category}>
          {course.category}
        </Badge>
      </div>

      <div className={styles.body}>
        <div className={styles.titles}>
          <Text role="label-md" as="p" tone="muted">
            {course.code} · {course.credits} Kredi
          </Text>
          <Text role="title-md" as="h3" tone="main" truncate>
            {course.title}
          </Text>
        </div>

        <p className={styles.nextLesson}>
          <Icon name="play_arrow" size="sm" />
          <Text role="body-sm" tone="muted">
            Sırada:
          </Text>
          <Text role="body-sm" tone="main" weight="semibold" truncate>
            {course.nextLesson}
          </Text>
        </p>

        <div className={styles.progress}>
          <div className={styles.progressLabel}>
            <Text role="body-sm" tone="muted">
              Tamamlanma
            </Text>
            <Text role="label-md" tone="navy" weight="bold">
              %{course.progress}
            </Text>
          </div>
          <ProgressBar
            value={course.progress}
            tone={course.progressTone}
            size="sm"
            label={`${course.title} tamamlanma oranı`}
          />
        </div>

        <Button variant="secondary" size="sm" fullWidth className={styles.cta}>
          Ders İçeriğine Git
        </Button>
      </div>
    </Card>
  );
}

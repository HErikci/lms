import { Badge, Button, Card, ProgressBar, Text } from '../../../components';
import type { ContinueLesson } from '../../../types';
import styles from './ContinueLearningCard.module.css';

interface ContinueLearningCardProps {
  lesson: ContinueLesson;
}

export function ContinueLearningCard({ lesson }: ContinueLearningCardProps) {
  return (
    <Card padding="lg" className={styles.card}>
      <header className={styles.header}>
        <span className={styles.heading}>
          <span className={styles.liveDot} aria-hidden="true" />
          <Text role="headline-sm" as="h2" tone="navy" weight="bold">
            Kaldığın Yerden Devam Et
          </Text>
        </span>
        <Badge tone="info" variant="soft">
          Ders #{lesson.lessonNumber} · {lesson.lessonTopic}
        </Badge>
      </header>

      <div className={styles.body}>
        <figure className={styles.media}>
          <img src={lesson.thumbnailUrl} alt={lesson.thumbnailAlt} className={styles.image} />
          <span className={styles.mediaScrim} aria-hidden="true" />
          <figcaption className={styles.remaining}>{lesson.remainingMinutes} dk kaldı</figcaption>
        </figure>

        <div className={styles.details}>
          <Text role="label-lg" as="p" tone="secondary">
            {lesson.courseTitle} · {lesson.instructor}
          </Text>

          <Text role="headline-md" as="h3" tone="main">
            {lesson.title}
          </Text>

          <Text role="body-md" as="p" tone="muted">
            {lesson.description}
          </Text>

          <div className={styles.progress}>
            <div className={styles.progressLabel}>
              <Text role="label-md" tone="muted">
                Modül Tamamlanma Oranı
              </Text>
              <Text role="label-md" tone="navy" weight="bold">
                %{lesson.moduleProgress}
              </Text>
            </div>
            <ProgressBar
              value={lesson.moduleProgress}
              tone="gradient"
              label="Modül tamamlanma oranı"
            />
          </div>

          <div className={styles.actions}>
            <Button variant="primary" iconStart="play_circle" iconFilled>
              Ders Videosunu Başlat
            </Button>
            <Button variant="secondary" iconStart="description">
              Ders Notları & Kodlar
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

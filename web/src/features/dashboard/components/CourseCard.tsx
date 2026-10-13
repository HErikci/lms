import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, Icon, ProgressBar, Text } from '../../../components';
import type { CourseSummary } from '../../../types';
import { youTubeThumbnail } from '../../courses/youtube';
import styles from './CourseCard.module.css';

interface CourseCardProps {
  course: CourseSummary;
}

export function CourseCard({ course }: CourseCardProps) {
  const navigate = useNavigate();
  const [imageFailed, setImageFailed] = useState(false);

  const percent = course.progress?.percent ?? 0;
  const next = course.nextLesson ?? null;
  const thumbnail =
    next?.contentType === 'VIDEO_YOUTUBE' && !imageFailed ? youTubeThumbnail(next.contentUrl) : null;
  const leadInstructor = course.instructors?.[0]?.name;
  const meta = [course.level, `${course.moduleCount ?? 0} modül`, leadInstructor]
    .filter(Boolean)
    .join(' · ');

  const target = next ? `/kurslarim/${course.id}/ders/${next.id}` : `/kurslarim/${course.id}`;

  return (
    <Card as="article" padding="none" interactive className={styles.card}>
      <div className={styles.media}>
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={`${course.title} küçük resmi`}
            className={styles.image}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className={styles.fallbackTitle}>{course.title}</span>
        )}
        <Badge tone="navy" variant="solid" shape="rounded" className={styles.category}>
          {course.category}
        </Badge>
      </div>

      <div className={styles.body}>
        <div className={styles.titles}>
          <Text role="label-md" as="p" tone="muted" truncate>
            {meta}
          </Text>
          <Text role="title-md" as="h3" tone="main" truncate>
            {course.title}
          </Text>
        </div>

        {next ? (
          <p className={styles.nextLesson}>
            <Icon name="play_arrow" size="sm" />
            <Text role="body-sm" tone="muted">
              Sırada:
            </Text>
            <Text role="body-sm" tone="main" weight="semibold" truncate>
              {next.title}
            </Text>
          </p>
        ) : (
          percent === 100 && (
            <p className={styles.nextLesson}>
              <Icon name="check_circle" size="sm" />
              <Text role="body-sm" tone="main" weight="semibold">
                Tüm dersler tamamlandı
              </Text>
            </p>
          )
        )}

        <div className={styles.progress}>
          <div className={styles.progressLabel}>
            <Text role="body-sm" tone="muted">
              Tamamlanma
            </Text>
            <Text role="label-md" tone="navy" weight="bold">
              %{percent}
            </Text>
          </div>
          <ProgressBar
            value={percent}
            tone={percent === 100 ? 'success' : 'gradient'}
            size="sm"
            label={`${course.title} tamamlanma oranı`}
          />
        </div>

        <Button variant="secondary" size="sm" fullWidth className={styles.cta} onClick={() => navigate(target)}>
          Ders İçeriğine Git
        </Button>
      </div>
    </Card>
  );
}

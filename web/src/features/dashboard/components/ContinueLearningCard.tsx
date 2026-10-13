import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, Icon, ProgressBar, Text } from '../../../components';
import { useContinueLesson } from '../useContinueLesson';
import { CONTENT_TYPE_ICONS } from '../../courses/contentType';
import { youTubeThumbnail } from '../../courses/youtube';
import styles from './ContinueLearningCard.module.css';

export function ContinueLearningCard() {
  const navigate = useNavigate();
  const { data, loading, error, hasCourses } = useContinueLesson();

  const heading = (
    <span className={styles.heading}>
      <span className={styles.liveDot} aria-hidden="true" />
      <Text role="headline-sm" as="h2" tone="navy" weight="bold">
        Kaldığın Yerden Devam Et
      </Text>
    </span>
  );

  if (loading || error || !data) {
    return (
      <Card padding="lg" className={styles.card}>
        <header className={styles.header}>{heading}</header>
        <Text role="body-md" as="p" tone={error ? 'error' : 'muted'}>
          {loading
            ? 'Yükleniyor…'
            : error
              ? error
              : hasCourses
                ? 'Tüm kurslarını tamamladın, tebrikler!'
                : 'Henüz bir kursa kayıtlı değilsin.'}
        </Text>
        {!loading && !error && !hasCourses && (
          <Link to="/kurslarim">
            <Text role="label-md" as="span" tone="secondary">
              Kurslara göz at →
            </Text>
          </Link>
        )}
      </Card>
    );
  }

  const { lesson } = data;
  const thumbnail = lesson.contentType === 'VIDEO_YOUTUBE' ? youTubeThumbnail(lesson.contentUrl) : null;

  return (
    <Card padding="lg" className={styles.card}>
      <header className={styles.header}>
        {heading}
        <Badge tone="info" variant="soft">
          Ders #{data.lessonNumber} · {data.moduleTitle}
        </Badge>
      </header>

      <div className={styles.body}>
        <figure className={styles.media}>
          {thumbnail ? (
            <img src={thumbnail} alt={`${lesson.title} video küçük resmi`} className={styles.image} />
          ) : (
            <span className={styles.mediaIcon}>
              <Icon name={CONTENT_TYPE_ICONS[lesson.contentType]} size="xl" />
            </span>
          )}
          <span className={styles.mediaScrim} aria-hidden="true" />
          <figcaption className={styles.remaining}>
            {data.lessonNumber} / {data.totalLessons} ders
          </figcaption>
        </figure>

        <div className={styles.details}>
          <Text role="label-lg" as="p" tone="secondary">
            {data.courseTitle}
          </Text>

          <Text role="headline-md" as="h3" tone="main">
            {lesson.title}
          </Text>

          {lesson.description && (
            <Text role="body-md" as="p" tone="muted">
              {lesson.description}
            </Text>
          )}

          <div className={styles.progress}>
            <div className={styles.progressLabel}>
              <Text role="label-md" tone="muted">
                Modül Tamamlanma Oranı
              </Text>
              <Text role="label-md" tone="navy" weight="bold">
                %{data.moduleProgress}
              </Text>
            </div>
            <ProgressBar value={data.moduleProgress} tone="gradient" label="Modül tamamlanma oranı" />
          </div>

          <div className={styles.actions}>
            <Button
              variant="primary"
              iconStart="play_circle"
              iconFilled
              onClick={() => navigate(`/kurslarim/${data.courseId}/ders/${lesson.id}`)}
            >
              {data.notStarted ? 'Derse Başla' : 'Derse Devam Et'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

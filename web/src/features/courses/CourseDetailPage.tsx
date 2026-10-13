import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card, Icon, Panel, Text } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import { useCourseDetail } from './useCourseDetail';
import { CONTENT_TYPE_BADGE_TONES, CONTENT_TYPE_ICONS, CONTENT_TYPE_LABELS } from './contentType';
import styles from './CourseDetailPage.module.css';

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { course, loading, error, enrolling, enroll } = useCourseDetail(id);

  return (
    <PageContainer>
      <div className={styles.header}>
        <Link to="/kurslarim" className={styles.backLink}>
          <Text role="label-md" as="span" tone="secondary">
            ← Kurslarıma Dön
          </Text>
        </Link>
      </div>

      {loading && <Text role="body-md">Yükleniyor…</Text>}
      {!loading && error && (
        <Text role="body-md" tone="error">
          {error}
        </Text>
      )}

      {!loading && !error && course && (
        <>
          <div className={styles.titleRow}>
            <div>
              <Text role="headline-lg" as="h1">
                {course.title}
              </Text>
              <Text role="body-sm" tone="muted" as="p" className={styles.meta}>
                {course.category} · {course.level}
              </Text>
            </div>
            <Badge tone="secondary" variant="soft">
              {course.accessMode === 'SEQUENTIAL' ? 'Sıralı Erişim' : 'Serbest Erişim'}
            </Badge>
          </div>

          <Text role="body-lg" as="p" className={styles.description}>
            {course.description}
          </Text>

          {!course.isEnrolled && (
            <Card padding="lg" elevation="1" className={styles.lockedCard}>
              <Text role="title-md" as="h2" tone="main">
                İçerik kilitli
              </Text>
              <Text role="body-md" tone="muted" as="p" className={styles.lockedMessage}>
                Bu kursun içeriğini görüntülemek için kayıt olmalısınız.
              </Text>
              <Button variant="primary" onClick={enroll} disabled={enrolling}>
                {enrolling ? 'Kaydediliyor…' : 'Kayıt Ol'}
              </Button>
            </Card>
          )}

          {course.isEnrolled && (
            <Panel title="Modüller ve Dersler" icon="menu_book">
              {course.modules.length === 0 && (
                <Text role="body-md" tone="muted">
                  Bu kurs için henüz modül eklenmemiş.
                </Text>
              )}
              <div className={styles.moduleList}>
                {course.modules.map((module) => (
                  <Card key={module.id} padding="md" elevation="1">
                    <Text role="title-md" as="h3" tone="main">
                      {module.title}
                    </Text>
                    <ul className={styles.lessonList}>
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id} className={styles.lessonItem}>
                          <Link to={`/kurslarim/${course.id}/ders/${lesson.id}`} className={styles.lessonLink}>
                            <div className={styles.lessonHeader}>
                              <Icon name={CONTENT_TYPE_ICONS[lesson.contentType]} size="sm" />
                              <Text role="body-md" as="span">
                                {lesson.title}
                              </Text>
                              <Badge tone={CONTENT_TYPE_BADGE_TONES[lesson.contentType]} variant="soft">
                                {CONTENT_TYPE_LABELS[lesson.contentType]}
                              </Badge>
                            </div>
                            {lesson.description && (
                              <Text role="body-sm" tone="muted" as="p" className={styles.lessonDescription}>
                                {lesson.description}
                              </Text>
                            )}
                          </Link>
                        </li>
                      ))}
                      {module.lessons.length === 0 && (
                        <li className={styles.lessonItem}>
                          <Text role="body-sm" tone="muted">
                            Bu modülde henüz ders yok.
                          </Text>
                        </li>
                      )}
                    </ul>
                  </Card>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </PageContainer>
  );
}

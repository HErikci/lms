import { Link, useParams } from 'react-router-dom';
import { Card, Icon, Text } from '../../../components';
import { PageContainer } from '../../../layout/PageContainer';
import { useCurrentUser } from '../../../data/useCurrentUser';
import { useLessonGrades } from './data/useLessonGrades';
import { GradeRow } from './components/GradeRow';
import styles from './QuizGradesPage.module.css';

export function QuizGradesPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const { user } = useCurrentUser();
  const { lesson, rows, loading, error, forbidden, saveGrade, deleteGrade } = useLessonGrades(lessonId);

  // ADMIN içerik yönetimi sayfasından gelir; eğitmenin yönetim menüsü yoktur, kurs sayfasına döner.
  const targetCourseId = lesson?.courseId ?? courseId;
  const isAdmin = user?.role === 'ADMIN';
  const backTo = isAdmin ? `/yonetim/kurslar/${targetCourseId}/icerik` : `/kurslarim/${targetCourseId}`;
  const backLabel = isAdmin ? '← İçerik Yönetimine Dön' : '← Kursa Dön';

  const gradedCount = rows.filter((row) => row.score !== null).length;
  const ready = !loading && !error;

  return (
    <PageContainer>
      <div className={styles.header}>
        <Link to={backTo} className={styles.backLink}>
          <Text role="label-md" as="span" tone="secondary">
            {backLabel}
          </Text>
        </Link>
        <Text role="headline-lg" as="h1">
          {lesson?.title ?? 'Quiz Notları'}
        </Text>
        {ready && lesson && (
          <Text role="body-md" tone="muted" as="p">
            Quiz notları · {gradedCount} / {rows.length} öğrenci notlandırıldı
          </Text>
        )}
      </div>

      {loading && <Text role="body-md">Yükleniyor…</Text>}

      {!loading && forbidden && (
        <Card padding="lg" elevation="1" className={styles.notice}>
          <Icon name="lock" size="xl" />
          <Text role="title-md" as="h2" tone="main">
            Bu sayfaya erişim yetkiniz yok
          </Text>
          <Text role="body-md" tone="muted" as="p">
            Quiz notlarını yalnızca yöneticiler ve dersin kursuna atanmış eğitmenler girebilir.
          </Text>
        </Card>
      )}

      {!loading && error && !forbidden && (
        <div role="alert">
          <Text role="body-md" tone="error" as="p">
            {error}
          </Text>
        </div>
      )}

      {ready && rows.length === 0 && <Text role="body-md">Bu kursa kayıtlı öğrenci yok.</Text>}

      {ready && rows.length > 0 && (
        <ul className={styles.list}>
          {rows.map((row) => (
            <li key={row.student.id}>
              <GradeRow row={row} onSave={saveGrade} onDelete={deleteGrade} />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}

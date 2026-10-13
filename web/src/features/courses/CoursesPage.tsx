import { Badge, Card, Text } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import { useCourses } from './useCourses';
import styles from './CoursesPage.module.css';

export function CoursesPage() {
  const { courses, loading, error } = useCourses();

  return (
    <PageContainer>
      <div className={styles.header}>
        <Text role="headline-lg" as="h1">
          Kayıtlı Kurslarım
        </Text>
        {!loading && !error && (
          <Text role="body-md" tone="muted" as="p">
            {courses.length} aktif kurs
          </Text>
        )}
      </div>

      {loading && <Text role="body-md">Yükleniyor…</Text>}
      {!loading && error && (
        <Text role="body-md" tone="error">
          {error}
        </Text>
      )}
      {!loading && !error && courses.length === 0 && (
        <Text role="body-md">Henüz kayıtlı bir kursunuz yok.</Text>
      )}

      {!loading && !error && courses.length > 0 && (
        <div className={styles.grid}>
          {courses.map((course) => (
            <Card key={course.id} padding="lg" elevation="1">
              <div className={styles.courseCard}>
                <div className={styles.courseHeader}>
                  <div>
                    <Text role="title-md" as="h2" tone="main">
                      {course.title}
                    </Text>
                    <Text role="body-sm" tone="muted">
                      {course.category} · {course.level}
                    </Text>
                  </div>
                  <Badge tone="secondary" variant="soft">
                    {course.accessMode === 'SEQUENTIAL' ? 'Sıralı Erişim' : 'Serbest Erişim'}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

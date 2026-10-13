import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, IconButton, Text } from '../../../components';
import { PageContainer } from '../../../layout/PageContainer';
import { useCourseStudents } from './data/useAdminCourses';
import styles from './CourseStudentsPage.module.css';

export function CourseStudentsPage() {
  const { id } = useParams<{ id: string }>();
  const { students, loading, error, removeStudent } = useCourseStudents(id);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleRemove = async (studentId: string, name: string) => {
    const confirmed = window.confirm(
      `${name} adlı öğrencinin kursa kaydını kaldırmak istediğinize emin misiniz?`,
    );
    if (!confirmed) return;

    setActionError(null);
    try {
      await removeStudent(studentId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Kayıt kaldırılamadı.');
    }
  };

  return (
    <PageContainer>
      <div className={styles.header}>
        <Link to="/yonetim/kurslar" className={styles.backLink}>
          <Text role="label-md" as="span" tone="secondary">
            ← Kurs Yönetimine Dön
          </Text>
        </Link>
        <Text role="headline-lg" as="h1">
          Kayıtlı Öğrenciler
        </Text>
        {!loading && !error && (
          <Text role="body-md" tone="muted" as="p">
            {students.length} öğrenci
          </Text>
        )}
      </div>

      {actionError && (
        <Text role="body-md" tone="error" as="p">
          {actionError}
        </Text>
      )}

      {loading && <Text role="body-md">Yükleniyor…</Text>}
      {!loading && error && (
        <Text role="body-md" tone="error">
          {error}
        </Text>
      )}
      {!loading && !error && students.length === 0 && (
        <Text role="body-md">Bu kursa kayıtlı öğrenci bulunmuyor.</Text>
      )}

      {!loading && !error && students.length > 0 && (
        <div className={styles.list}>
          {students.map((student) => (
            <Card key={student.id} padding="md" elevation="1">
              <div className={styles.row}>
                <div>
                  <Text role="title-md" as="h2" tone="main">
                    {student.name}
                  </Text>
                  <Text role="body-sm" tone="muted">
                    {student.email} · Kayıt: {new Date(student.enrolledAt).toLocaleDateString('tr-TR')}{' '}
                    · {student.method}
                  </Text>
                </div>
                <IconButton
                  icon="person_remove"
                  label="Kaydı Kaldır"
                  onClick={() => handleRemove(student.id, student.name)}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

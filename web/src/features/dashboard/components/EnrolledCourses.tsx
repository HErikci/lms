import { Link } from 'react-router-dom';
import { Icon, SectionHeader, Text } from '../../../components';
import { useCourses } from '../../courses/useCourses';
import { CourseCard } from './CourseCard';
import styles from './EnrolledCourses.module.css';

const VISIBLE_COUNT = 3;

export function EnrolledCourses() {
  const { courses, loading, error } = useCourses();

  return (
    <section className={styles.section} aria-labelledby="enrolled-courses">
      <SectionHeader
        title="Kayıtlı Kurslarım"
        subtitle="Dönem içi ilerlemenizi ve sonraki dersleri buradan yönetin"
        action={
          <Link to="/kurslarim" className={styles.seeAll}>
            <Text role="label-lg" tone="inherit">
              Tümünü Gör ({loading || error ? '—' : courses.length})
            </Text>
            <Icon name="arrow_forward" size="sm" />
          </Link>
        }
      />

      {loading || error || courses.length === 0 ? (
        <div className={styles.state}>
          <Text role="body-md" as="p" tone={error ? 'error' : 'muted'}>
            {loading ? 'Yükleniyor…' : error ? error : 'Henüz bir kursa kayıtlı değilsin.'}
          </Text>
          {!loading && !error && (
            <Link to="/kurslarim" className={styles.seeAll}>
              <Text role="label-md" as="span" tone="inherit">
                Kurslara göz at →
              </Text>
            </Link>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {courses.slice(0, VISIBLE_COUNT).map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </section>
  );
}

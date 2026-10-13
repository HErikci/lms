import { Icon, SectionHeader, Text } from '../../../components';
import type { Course } from '../../../types';
import { CourseCard } from './CourseCard';
import styles from './EnrolledCourses.module.css';

interface EnrolledCoursesProps {
  courses: Course[];
  totalCount: number;
}

export function EnrolledCourses({ courses, totalCount }: EnrolledCoursesProps) {
  return (
    <section className={styles.section} aria-labelledby="enrolled-courses">
      <SectionHeader
        title="Kayıtlı Kurslarım"
        subtitle="Dönem içi ilerlemenizi ve sonraki dersleri buradan yönetin"
        action={
          <a href="#" className={styles.seeAll}>
            <Text role="label-lg" tone="inherit">
              Tümünü Gör ({totalCount})
            </Text>
            <Icon name="arrow_forward" size="sm" />
          </a>
        }
      />

      <div className={styles.grid}>
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </section>
  );
}

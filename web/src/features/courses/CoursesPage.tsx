import { Badge, Card, Icon, ProgressBar, Text } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import styles from './CoursesPage.module.css';

interface Course {
  id: string;
  code: string;
  title: string;
  instructor: string;
  credits: number;
  progress: number;
  nextLesson: string;
}

const courses: Course[] = [
  {
    id: 'ceng201',
    code: 'CENG 201',
    title: 'Veri Yapıları ve Algoritmalar',
    instructor: 'Prof. Ahmet Yılmaz',
    credits: 4,
    progress: 85,
    nextLesson: 'İkili Arama Ağaçları',
  },
  {
    id: 'ai304',
    code: 'AI 304',
    title: 'Yapay Zekâ ve ML Temelleri',
    instructor: 'Doç. Dr. Fatih Kaya',
    credits: 3,
    progress: 40,
    nextLesson: 'Denetimli Öğrenme',
  },
  {
    id: 'swe212',
    code: 'SWE 212',
    title: 'Veritabanı Sistemleri & SQL',
    instructor: 'Dr. Murat Yılmaz',
    credits: 4,
    progress: 90,
    nextLesson: 'İndeksleme Stratejileri',
  },
  {
    id: 'math301',
    code: 'MATH 301',
    title: 'Matematiksel Analiz III',
    instructor: 'Prof. Serkan Özdemir',
    credits: 4,
    progress: 72,
    nextLesson: 'Çok Değişkenli Kalkülüs',
  },
];

export function CoursesPage() {
  return (
    <PageContainer>
      <div className={styles.header}>
        <Text role="headline-lg" as="h1">
          Kayıtlı Kurslarım
        </Text>
        <Text role="body-md" tone="muted" as="p">
          {courses.length} aktif kurs · {courses.reduce((sum, c) => sum + c.credits, 0)} kredi
        </Text>
      </div>

      <div className={styles.grid}>
        {courses.map((course) => (
          <Card key={course.id} padding="lg" elevation="1">
            <div className={styles.courseCard}>
              <div className={styles.courseHeader}>
                <div>
                  <Text role="label-md" tone="secondary">
                    {course.code}
                  </Text>
                  <Text role="title-md" as="h2" tone="main">
                    {course.title}
                  </Text>
                </div>
                <Badge tone="secondary" variant="soft">
                  {course.credits} Kredi
                </Badge>
              </div>

              <Text role="body-sm" tone="muted">
                {course.instructor}
              </Text>

              <div className={styles.progress}>
                <div className={styles.progressLabel}>
                  <Text role="label-md">İlerleme</Text>
                  <Text role="label-md" tone="secondary">
                    %{course.progress}
                  </Text>
                </div>
                <ProgressBar
                  value={course.progress}
                  tone="gradient"
                  label={`${course.title} ilerleme %${course.progress}`}
                />
              </div>

              <div className={styles.nextLesson}>
                <Icon name="play_circle" size="sm" />
                <div>
                  <Text role="label-md" tone="muted">
                    Sırada
                  </Text>
                  <Text role="body-sm">{course.nextLesson}</Text>
                </div>
              </div>

              <a href="#" className={styles.action}>
                <Text role="label-md">Derse Git</Text>
                <Icon name="arrow_forward" size="sm" />
              </a>
            </div>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}

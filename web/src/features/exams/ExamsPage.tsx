import { Badge, Card, Icon, ProgressBar, Text } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import styles from './ExamsPage.module.css';

interface Exam {
  id: string;
  title: string;
  course: string;
  date: string;
  type: 'quiz' | 'midterm' | 'final';
  duration: number;
  topics: string;
  status: 'upcoming' | 'completed' | 'graded';
  score?: number;
}

const exams: Exam[] = [
  {
    id: 'exam-1',
    title: 'SQL Ara Sınavı',
    course: 'SWE 212',
    date: '30 Ekim 14:00',
    type: 'quiz',
    duration: 45,
    topics: 'Modül 1-4: SELECT, JOIN, GROUP BY, Aggregate Functions',
    status: 'upcoming',
  },
  {
    id: 'exam-2',
    title: 'Veri Yapıları Kısa Quiz 3',
    course: 'CENG 201',
    date: '25 Ekim 10:00',
    type: 'quiz',
    duration: 15,
    topics: 'İkili Arama Ağaçları',
    status: 'completed',
  },
  {
    id: 'exam-3',
    title: 'Yapay Zekâ Ara Sınavı',
    course: 'AI 304',
    date: '8 Kasım 14:00',
    type: 'midterm',
    duration: 90,
    topics: 'Temel ML Algoritmaları, Denetimli & Denetimsiz Öğrenme',
    status: 'upcoming',
  },
  {
    id: 'exam-4',
    title: 'Matematik III Ara Sınavı',
    course: 'MATH 301',
    date: '18 Ekim 10:00',
    type: 'midterm',
    duration: 120,
    topics: 'Çok Değişkenli Kalkülüs, İntegral, Vektör Analizi',
    status: 'graded',
    score: 78,
  },
];

function getExamIcon(type: Exam['type']) {
  switch (type) {
    case 'quiz':
      return 'quiz';
    case 'midterm':
      return 'assignment';
    case 'final':
      return 'school';
  }
}

function getStatusBadge(status: Exam['status']) {
  switch (status) {
    case 'upcoming':
      return { tone: 'warning' as const, label: 'Yaklaşıyor' };
    case 'completed':
      return { tone: 'cyan' as const, label: 'Tamamlandı' };
    case 'graded':
      return { tone: 'success' as const, label: 'Puanlandı' };
  }
}

export function ExamsPage() {
  return (
    <PageContainer>
      <div className={styles.header}>
        <Text role="headline-lg" as="h1">
          Sınavlar
        </Text>
        <Text role="body-md" tone="muted" as="p">
          {exams.filter((e) => e.status === 'upcoming').length} yaklaşan · {exams.filter((e) => e.status === 'graded').length} puanlandı
        </Text>
      </div>

      <div className={styles.grid}>
        {exams.map((exam) => {
          const { tone, label } = getStatusBadge(exam.status);
          return (
            <Card key={exam.id} padding="lg" elevation="1">
              <a href="#" className={styles.examCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.iconSection}>
                    <Icon name={getExamIcon(exam.type)} size="lg" filled />
                  </div>
                  <div>
                    <Text role="label-md" tone="secondary">
                      {exam.course}
                    </Text>
                    <Text role="title-md" as="h3">
                      {exam.title}
                    </Text>
                  </div>
                  <Badge tone={tone} variant="soft">
                    {label}
                  </Badge>
                </div>

                <Text role="body-sm" tone="muted">
                  {exam.topics}
                </Text>

                <div className={styles.examDetails}>
                  <div className={styles.detail}>
                    <Icon name="schedule" size="sm" />
                    <Text role="body-sm">{exam.date}</Text>
                  </div>
                  <div className={styles.detail}>
                    <Icon name="schedule" size="sm" />
                    <Text role="body-sm">{exam.duration} dakika</Text>
                  </div>
                </div>

                {exam.status === 'graded' && exam.score !== undefined && (
                  <div className={styles.scoreSection}>
                    <div className={styles.scoreLabel}>
                      <Text role="label-md">Puan</Text>
                      <Text role="label-md" weight="bold" tone="main">
                        {exam.score} / 100
                      </Text>
                    </div>
                    <ProgressBar
                      value={exam.score}
                      tone={exam.score >= 70 ? 'success' : 'warning'}
                      label={`${exam.title} puanı %${exam.score}`}
                    />
                  </div>
                )}

                <div className={styles.cardAction}>
                  <Text role="label-md" tone="secondary">
                    {exam.status === 'upcoming' ? 'Detayları Gör' : 'Sonuçları Gör'}
                  </Text>
                  <Icon name="arrow_forward" size="sm" />
                </div>
              </a>
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}

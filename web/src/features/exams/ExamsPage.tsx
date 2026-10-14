import { Link } from 'react-router-dom';
import { Badge, Card, Icon, Text } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import { useCurrentUser } from '../../data/useCurrentUser';
import type { ExamAvailability, MyExam } from '../../types';
import { AVAILABILITY, EXAM_TYPES, formatDuration, formatWindow } from './examMeta';
import { useMyExams } from './useMyExams';
import styles from './ExamsPage.module.css';

const SECTIONS: { key: ExamAvailability; title: string }[] = [
  { key: 'OPEN', title: 'Şu an açık' },
  { key: 'UPCOMING', title: 'Yaklaşan sınavlar' },
  { key: 'CLOSED', title: 'Sona eren sınavlar' },
];

function ExamCard({ exam }: { exam: MyExam }) {
  const type = EXAM_TYPES[exam.type];
  const availability = AVAILABILITY[exam.availability];
  return (
    <Card as="article" padding="lg" elevation="1" className={styles.examCard}>
      <div className={styles.cardHeader}>
        <span className={styles.iconSection}>
          <Icon name={type.icon} size="lg" filled />
        </span>
        <div>
          <Text role="label-md" tone="secondary">
            {exam.course.title}
          </Text>
          <Text role="title-md" as="h3">
            {exam.title}
          </Text>
        </div>
      </div>

      {exam.description && (
        <Text role="body-sm" tone="muted" as="p" className={styles.description}>
          {exam.description}
        </Text>
      )}

      {exam.learningObjectives.length > 0 && (
        <div>
          <Text role="label-md">Ölçülen öğrenme hedefleri</Text>
          <ul className={styles.objectives}>
            {exam.learningObjectives.map((objective, index) => <li key={index}>{objective}</li>)}
          </ul>
        </div>
      )}

      <dl className={styles.examDetails}>
        <div className={styles.detail}>
          <dt>
            <Icon name="event" size="sm" />
            <span className={styles.srOnly}>Zaman</span>
          </dt>
          <dd>
            <Text role="body-sm">{formatWindow(exam.startsAt, exam.endsAt)}</Text>
          </dd>
        </div>
        <div className={styles.detail}>
          <dt>
            <Icon name="timer" size="sm" />
            <span className={styles.srOnly}>Süre</span>
          </dt>
          <dd>
            <Text role="body-sm">{formatDuration(exam.durationMinutes)}</Text>
          </dd>
        </div>
        <div className={styles.detail}>
          <dt>
            <Icon name="help" size="sm" />
            <span className={styles.srOnly}>Soru sayısı</span>
          </dt>
          <dd>
            <Text role="body-sm">{exam.questionCount} soru</Text>
          </dd>
        </div>
        <div className={styles.detail}>
          <dt>
            <Icon name="replay" size="sm" />
            <span className={styles.srOnly}>Deneme hakkı</span>
          </dt>
          <dd>
            <Text role="body-sm">{exam.attemptsUsed} / {exam.maxAttempts} deneme kullanıldı</Text>
          </dd>
        </div>
      </dl>

      <div className={styles.cardFooter}>
        <span className={styles.badges}>
          <Badge tone={availability.tone} variant="soft" icon={availability.icon}>
            {availability.label}
          </Badge>
          <Badge tone="neutral">{type.label}</Badge>
        </span>
        {exam.passingScore !== null && (
          <Text role="label-md" tone="muted" className={styles.passing}>
            Geçme notu %{exam.passingScore}
          </Text>
        )}
      </div>
      {exam.latestResult && (
        <Text role="body-sm" tone={exam.latestResult.passed === false ? 'warning' : 'success'}>
          Son sonuç: %{exam.latestResult.score}
          {exam.latestResult.passed === null ? '' : exam.latestResult.passed ? ' · Başarılı' : ' · Geçme notunun altında'}
        </Text>
      )}
      {exam.startBlockedReason && <Text role="body-sm" tone="muted">{exam.startBlockedReason}</Text>}
      <Link to={`/sinavlar/${exam.id}`} className={styles.manageLink}>
        <Icon name="quiz" size="sm" />
        {exam.canStart ? 'Sınava git' : exam.attemptsUsed > 0 ? 'Denememi görüntüle' : 'Sınav bilgileri'}
      </Link>
    </Card>
  );
}

export function ExamsPage() {
  const { user } = useCurrentUser();
  const { exams, loading, error, reload } = useMyExams();
  const canManage = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';

  const count = (key: ExamAvailability) => exams.filter((exam) => exam.availability === key).length;

  return (
    <PageContainer>
      <div className={styles.header}>
        <div>
          <Text role="headline-lg" as="h1">
            Sınavlar
          </Text>
          <Text role="body-md" tone="muted" as="p">
            {loading ? 'Yükleniyor…' : `${count('OPEN')} açık · ${count('UPCOMING')} yaklaşan · ${count('CLOSED')} sona erdi`}
          </Text>
        </div>
        {canManage && (
          <Link to="/yonetim/sinavlar" className={styles.manageLink}>
            <Icon name="fact_check" size="sm" />
            Sınavları yönet
          </Link>
        )}
      </div>

      {error && (
        <div role="alert">
          <Text role="body-md" tone="error" as="p">{error}</Text>
          <button type="button" onClick={reload} className={styles.manageLink}>Yeniden dene</button>
        </div>
      )}

      {!loading && !error && exams.length === 0 && (
        <Card padding="lg" elevation="1">
          <Text role="body-md" tone="muted" as="p">
            Size atanmış bir sınav yok. Kayıtlı olduğunuz kurslarda yayınlanan sınavlar burada görünür.
          </Text>
        </Card>
      )}

      {SECTIONS.map((section) => {
        const items = exams.filter((exam) => exam.availability === section.key);
        if (items.length === 0) return null;
        return (
          <section key={section.key} className={styles.section} aria-labelledby={`exams-${section.key}`}>
            <Text role="title-md" as="h2" className={styles.sectionTitle}>
              <span id={`exams-${section.key}`}>
                {section.title} ({items.length})
              </span>
            </Text>
            <div className={styles.grid}>
              {items.map((exam) => (
                <ExamCard key={exam.id} exam={exam} />
              ))}
            </div>
          </section>
        );
      })}
    </PageContainer>
  );
}

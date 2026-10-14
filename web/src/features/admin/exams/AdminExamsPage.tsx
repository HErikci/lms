import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, ConfirmDialog, SearchInput, Text } from '../../../components';
import { PageContainer } from '../../../layout/PageContainer';
import { useCurrentUser } from '../../../data/useCurrentUser';
import type { ExamStatus, ManagedExam } from '../../../types';
import { useEventCourses } from '../../calendar/useEventCourses';
import { AVAILABILITY, EXAM_STATUS, EXAM_TYPES, formatDuration, formatWindow } from '../../exams/examMeta';
import { searchKey } from '../question-banks/questionMeta';
import { ExamCreateDialog } from './components/ExamCreateDialog';
import { createExam, deleteExam, useManagedExams } from './data/examApi';
import type { NewExamInput } from './data/examApi';
import styles from './AdminExamsPage.module.css';

export function AdminExamsPage() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const courses = useEventCourses(user);
  const { exams, loading, error, reload } = useManagedExams();
  const [statusFilter, setStatusFilter] = useState<ExamStatus | 'ALL'>('ALL');
  const [courseFilter, setCourseFilter] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ManagedExam | null>(null);

  const courseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const exam of exams) map.set(exam.course.id, exam.course.title);
    return [...map].sort((a, b) => a[1].localeCompare(b[1], 'tr'));
  }, [exams]);

  const counts = useMemo(
    () => ({
      ALL: exams.length,
      DRAFT: exams.filter((e) => e.status === 'DRAFT').length,
      PUBLISHED: exams.filter((e) => e.status === 'PUBLISHED').length,
    }),
    [exams],
  );

  const visible = exams.filter((exam) => {
    if (statusFilter !== 'ALL' && exam.status !== statusFilter) return false;
    if (courseFilter && exam.course.id !== courseFilter) return false;
    const term = searchKey(search.trim());
    return !term || searchKey(`${exam.title} ${exam.course.title}`).includes(term);
  });

  const handleCreate = async (input: NewExamInput) => {
    const detail = await createExam(input);
    navigate(`/yonetim/sinavlar/${detail.exam.id}`);
  };

  const tabs: { key: ExamStatus | 'ALL'; label: string }[] = [
    { key: 'ALL', label: 'Tümü' },
    { key: 'DRAFT', label: 'Taslak' },
    { key: 'PUBLISHED', label: 'Yayında' },
  ];

  return (
    <PageContainer>
      <div className={styles.header}>
        <div>
          <Text role="headline-lg" as="h1">
            Sınav Yönetimi
          </Text>
          <Text role="body-md" tone="muted" as="p">
            Eğitim sonu sınavı için öğrenme hedeflerini belirleyin, soru bankasından kısa sorular seçin ve yayınlayın.
            Öğrenci, kursu tamamladığında sınava girebilir.
          </Text>
        </div>
        <div className={styles.headerActions}>
          <Link to="/yonetim/soru-bankasi" className={styles.secondaryLink}>
            Soru Bankası
          </Link>
          <Button variant="primary" iconStart="add" disabled={courses.length === 0} onClick={() => setCreating(true)}>
            Yeni Sınav
          </Button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="group" aria-label="Duruma göre süz">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={styles.tab}
              aria-pressed={statusFilter === tab.key}
              onClick={() => setStatusFilter(tab.key)}
            >
              {tab.label} <span className={styles.count}>{counts[tab.key]}</span>
            </button>
          ))}
        </div>
        <SearchInput
          label="Sınav ara"
          placeholder="Sınav ara"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={styles.search}
        />
        <label className={styles.filter}>
          <span className={styles.srOnly}>Kurs</span>
          <select className={styles.select} value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
            <option value="">Tüm kurslar</option>
            {courseOptions.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <Text role="body-md" tone="error" as="p">
          {error}
        </Text>
      )}
      {loading && exams.length === 0 && (
        <Text role="body-md" tone="muted" as="p">
          Yükleniyor…
        </Text>
      )}
      {!loading && !error && visible.length === 0 && (
        <Card padding="lg" elevation="1">
          <Text role="body-md" tone="muted" as="p">
            {exams.length === 0 ? 'Henüz sınav yok. "Yeni Sınav" ile ilkini oluşturun.' : 'Süzgeçlere uyan sınav yok.'}
          </Text>
        </Card>
      )}

      {visible.length > 0 && (
        <Card padding="none" elevation="1" className={styles.tableCard}>
          <table className={styles.table}>
            <thead className="label-md">
              <tr>
                <th scope="col">Sınav</th>
                <th scope="col">Durum</th>
                <th scope="col">Zaman</th>
                <th scope="col">Sorular</th>
                <th scope="col">Öğrenci</th>
                <th scope="col">
                  <span className={styles.srOnly}>İşlemler</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((exam) => {
                const status = EXAM_STATUS[exam.status];
                const availability = AVAILABILITY[exam.availability];
                return (
                  <tr key={exam.id}>
                    <td data-label="Sınav">
                      <span className={styles.examCell}>
                        <Text role="label-lg" tone="main">
                          <Link to={`/yonetim/sinavlar/${exam.id}`} className={styles.examLink}>
                            {exam.title}
                          </Link>
                        </Text>
                        <Text role="body-sm" tone="muted">
                          {exam.course.title} · {EXAM_TYPES[exam.type].label}
                        </Text>
                        {exam.requiresCourseCompletion && <Badge tone="cyan" icon="school">Eğitim sonu</Badge>}
                      </span>
                    </td>
                    <td data-label="Durum">
                      <span className={styles.badges}>
                        <Badge tone={status.tone} icon={status.icon}>
                          {status.label}
                        </Badge>
                        {exam.status === 'PUBLISHED' && (
                          <Badge tone={availability.tone} variant="soft">
                            {availability.label}
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td data-label="Zaman">
                      <span className={styles.stack}>
                        <Text role="body-sm">{formatWindow(exam.startsAt, exam.endsAt)}</Text>
                        <Text role="body-sm" tone="muted">
                          {formatDuration(exam.durationMinutes)}
                        </Text>
                      </span>
                    </td>
                    <td data-label="Sorular">
                      <Text role="body-sm">
                        {exam.questionCount} soru · {exam.totalPoints} puan
                      </Text>
                    </td>
                    <td data-label="Öğrenci">
                      <Text role="body-sm">
                        {exam.candidateCount} {exam.audience === 'SELECTED' ? 'seçili' : 'kayıtlı'}
                      </Text>
                    </td>
                    <td className={styles.actionsCell}>
                      <span className={styles.actions}>
                        <Button variant="ghost" size="sm" iconStart="edit" onClick={() => navigate(`/yonetim/sinavlar/${exam.id}`)}>
                          Düzenle<span className={styles.srOnly}>: {exam.title}</span>
                        </Button>
                        <Button variant="ghost" size="sm" iconStart="delete" onClick={() => setDeleting(exam)}>
                          Sil<span className={styles.srOnly}>: {exam.title}</span>
                        </Button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {creating && <ExamCreateDialog courses={courses} onCreate={handleCreate} onClose={() => setCreating(false)} />}

      {deleting && (
        <ConfirmDialog
          title="Sınavı sil"
          confirmLabel="Sınavı sil"
          destructive
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteExam(deleting.id);
            setDeleting(null);
            reload();
          }}
        >
          <Text role="body-md" as="p">
            “{deleting.title}” sınavı silinecek. Sorular bankada kalır; yalnızca sınav ve öğrenci atamaları kaldırılır.
          </Text>
        </ConfirmDialog>
      )}
    </PageContainer>
  );
}

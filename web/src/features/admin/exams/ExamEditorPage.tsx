import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, ConfirmDialog, Icon, Text } from '../../../components';
import { PageContainer } from '../../../layout/PageContainer';
import type { ExamSettings, ExamStatus } from '../../../types';
import { AVAILABILITY, EXAM_STATUS, EXAM_TYPES, formatDuration, formatWindow } from '../../exams/examMeta';
import { ExamCandidatesPanel } from './components/ExamCandidatesPanel';
import { ExamQuestionsPanel } from './components/ExamQuestionsPanel';
import { ExamSettingsForm } from './components/ExamSettingsForm';
import { deleteExam, updateExam, useExamCandidates, useExamDetail } from './data/examApi';
import styles from './ExamEditorPage.module.css';

type TabKey = 'settings' | 'questions' | 'students';

export function ExamEditorPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const uid = useId();
  const { detail, setDetail, loading, error, reload } = useExamDetail(examId);
  const { candidates, loading: candidatesLoading, reload: reloadCandidates } = useExamCandidates(examId);
  const [tab, setTab] = useState<TabKey>('settings');
  const tabRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!detail) {
    return (
      <PageContainer>
        <Link to="/yonetim/sinavlar" className={styles.back}>
          <Icon name="arrow_back" size="sm" />
          Sınavlar
        </Link>
        {loading ? (
          <Text role="body-md" tone="muted" as="p">
            Yükleniyor…
          </Text>
        ) : (
          <Card padding="lg" elevation="1">
            <Text role="body-md" tone="error" as="p">
              {error ?? 'Sınav bulunamadı.'}
            </Text>
          </Card>
        )}
      </PageContainer>
    );
  }

  const { exam, questions } = detail;
  const status = EXAM_STATUS[exam.status];
  const availability = AVAILABILITY[exam.availability];

  // Sunucudaki yayın koşullarının istemci tarafı görünümü (asıl denetim sunucudadır).
  const checks = [
    { ok: questions.length > 0, label: questions.length > 0 ? `${questions.length} soru eklendi` : 'En az bir soru eklenmeli' },
    {
      ok: exam.randomQuestionCount === null || exam.randomQuestionCount <= questions.length,
      label:
        exam.randomQuestionCount === null
          ? 'Tüm sorular sorulacak'
          : `Rastgele seçilecek ${exam.randomQuestionCount} soru, sınavdaki ${questions.length} soruyu aşmamalı`,
    },
    {
      ok: exam.audience === 'COURSE' || exam.candidateCount > 0,
      label:
        exam.audience === 'COURSE'
          ? `Kursa kayıtlı tüm öğrenciler (${exam.candidateCount})`
          : exam.candidateCount > 0
            ? `${exam.candidateCount} öğrenci seçildi`
            : 'Seçili öğrenci modunda en az bir öğrenci seçilmeli',
    },
  ];
  const ready = checks.every((check) => check.ok);

  const changeStatus = async (next: ExamStatus) => {
    setStatusBusy(true);
    setStatusError(null);
    try {
      setDetail(await updateExam(exam.id, { status: next }));
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Durum değiştirilemedi.');
    } finally {
      setStatusBusy(false);
    }
  };

  const saveSettings = async (patch: Partial<ExamSettings>) => {
    setDetail(await updateExam(exam.id, patch));
  };

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'settings', label: 'Genel ayarlar', icon: 'tune' },
    { key: 'questions', label: `Sorular (${questions.length})`, icon: 'quiz' },
    { key: 'students', label: `Öğrenciler (${exam.candidateCount})`, icon: 'group' },
  ];

  // Sekmeler arasında ok tuşlarıyla, Home/End ile gezinme (WAI-ARIA sekme deseni).
  const handleTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((t) => t.key === tab);
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const next = tabs[nextIndex].key;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <PageContainer>
      <div className={styles.top}>
        <Link to="/yonetim/sinavlar" className={styles.back}>
          <Icon name="arrow_back" size="sm" />
          Sınavlar
        </Link>

        <div className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.badges}>
              <Badge tone="cyan" icon="menu_book">
                {exam.course.title}
              </Badge>
              <Badge tone="secondary" icon={EXAM_TYPES[exam.type].icon}>
                {EXAM_TYPES[exam.type].label}
              </Badge>
              <Badge tone={status.tone} icon={status.icon}>
                {status.label}
              </Badge>
              {exam.status === 'PUBLISHED' && (
                <Badge tone={availability.tone} variant="soft">
                  {availability.label}
                </Badge>
              )}
            </span>
            <Text role="headline-lg" as="h1">
              {exam.title}
            </Text>
            <Text role="body-md" tone="muted" as="p">
              {formatWindow(exam.startsAt, exam.endsAt)} · {formatDuration(exam.durationMinutes)} · {questions.length} soru ·{' '}
              {exam.totalPoints} puan
            </Text>
          </div>
          <div className={styles.headerActions}>
            {exam.status === 'PUBLISHED' ? (
              <Button variant="secondary" iconStart="unpublished" disabled={statusBusy} onClick={() => void changeStatus('DRAFT')}>
                Taslağa al
              </Button>
            ) : (
              <Button
                variant="primary"
                iconStart="publish"
                disabled={statusBusy || !ready}
                onClick={() => void changeStatus('PUBLISHED')}
              >
                Yayınla
              </Button>
            )}
            <Button variant="ghost" iconStart="delete" onClick={() => setDeleting(true)}>
              Sil
            </Button>
          </div>
        </div>

        <div aria-live="polite" className={styles.live}>
          {statusError && (
            <div className={styles.errorBanner} role="alert">
              <Text role="body-sm" tone="error" as="p">
                {statusError}
              </Text>
            </div>
          )}
        </div>
      </div>

      {exam.status === 'PUBLISHED' ? (
        <div className={styles.infoBanner}>
          <Icon name="visibility" size="sm" />
          <Text role="body-sm" as="p">
            Sınav yayında: öğrenciler “Sınavlar” sayfasında görüyor. Yaptığınız değişiklikler hemen yansır; sınavı
            geçersiz bırakacak değişiklikler (ör. son soruyu çıkarmak) engellenir.
          </Text>
        </div>
      ) : (
        <Card padding="md" elevation="1" className={styles.checklist}>
          <Text role="title-md" as="h2">
            Yayın kontrol listesi
          </Text>
          <ul>
            {checks.map((check) => (
              <li key={check.label} className={check.ok ? styles.ok : styles.missing}>
                <Icon name={check.ok ? 'check_circle' : 'error'} size="sm" filled />
                <Text role="body-sm" as="span">
                  {check.label}
                </Text>
                <span className={styles.srOnly}>{check.ok ? ' (tamam)' : ' (eksik)'}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className={styles.tabs} role="tablist" aria-label="Sınav düzenleme bölümleri" onKeyDown={handleTabKey}>
        {tabs.map((t) => (
          <button
            key={t.key}
            ref={(el) => {
              tabRefs.current[t.key] = el;
            }}
            type="button"
            role="tab"
            id={`${uid}-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`${uid}-panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            className={styles.tab}
            onClick={() => setTab(t.key)}
          >
            <Icon name={t.icon} size="sm" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Paneller gizlenir ama bağlı kalır: sekme değişince kaydedilmemiş girişler kaybolmaz. */}
      <div
        role="tabpanel"
        id={`${uid}-panel-settings`}
        aria-labelledby={`${uid}-tab-settings`}
        hidden={tab !== 'settings'}
        className={styles.panel}
      >
        <ExamSettingsForm exam={exam} questionCount={questions.length} onSave={saveSettings} />
      </div>
      <div
        role="tabpanel"
        id={`${uid}-panel-questions`}
        aria-labelledby={`${uid}-tab-questions`}
        hidden={tab !== 'questions'}
        className={styles.panel}
      >
        <ExamQuestionsPanel detail={detail} onDetailChange={setDetail} />
      </div>
      <div
        role="tabpanel"
        id={`${uid}-panel-students`}
        aria-labelledby={`${uid}-tab-students`}
        hidden={tab !== 'students'}
        className={styles.panel}
      >
        <ExamCandidatesPanel
          exam={exam}
          candidates={candidates}
          loading={candidatesLoading}
          onSaved={() => {
            reload();
            reloadCandidates();
          }}
        />
      </div>

      {deleting && (
        <ConfirmDialog
          title="Sınavı sil"
          confirmLabel="Sınavı sil"
          destructive
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await deleteExam(exam.id);
            navigate('/yonetim/sinavlar');
          }}
        >
          <Text role="body-md" as="p">
            “{exam.title}” sınavı silinecek. Sorular bankada kalır; yalnızca sınav ve öğrenci atamaları kaldırılır.
          </Text>
        </ConfirmDialog>
      )}
    </PageContainer>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card, ConfirmDialog, Text } from '../../components';
import { useCurrentUser } from '../../data/useCurrentUser';
import { PageContainer } from '../../layout/PageContainer';
import { apiFetch } from '../../lib/apiClient';
import { useApiResource } from '../../lib/useApiResource';
import type { StudentExamAttempt } from '../../types';
import { formatDateTime, formatDuration } from './examMeta';
import { useMyExams } from './useMyExams';
import styles from './ExamAttemptPage.module.css';

type Answers = StudentExamAttempt['answers'];
type Question = StudentExamAttempt['questions'][number];

function answered(question: Question, value: Answers[string] | undefined) {
  if (question.type === 'TRUE_FALSE') return typeof value === 'boolean';
  if (question.type === 'FILL_BLANK') {
    return Array.isArray(value) && value.length === question.content.blankCount && value.every((item) => item.trim());
  }
  if (question.type === 'MULTIPLE_CHOICE') return Array.isArray(value) && value.length > 0;
  return typeof value === 'string' && value.trim().length > 0;
}

function draftKey(userId: string, attemptId: string) {
  return `lms:exam-draft:${userId}:${attemptId}`;
}

function readDraft(key: string, attempt: StudentExamAttempt): Answers {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return attempt.answers;
    const result: Answers = { ...attempt.answers };
    for (const question of attempt.questions) {
      const value = (saved as Record<string, unknown>)[question.id];
      const options = new Set(question.content.options?.map((option) => option.id));
      if (question.type === 'TRUE_FALSE' && typeof value === 'boolean') result[question.id] = value;
      if (question.type === 'SINGLE_CHOICE' && typeof value === 'string' && options.has(value)) result[question.id] = value;
      if (question.type === 'SHORT_ANSWER' && typeof value === 'string') result[question.id] = value;
      if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
        if (question.type === 'MULTIPLE_CHOICE') result[question.id] = value.filter((item) => options.has(item));
        if (question.type === 'FILL_BLANK' && value.length === question.content.blankCount) result[question.id] = value;
      }
    }
    return result;
  } catch {
    return attempt.answers;
  }
}

function answerLabel(question: Question, value: Answers[string] | undefined): string {
  if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return 'Yanıt verilmedi';
  if (typeof value === 'boolean') return value ? 'Doğru' : 'Yanlış';
  const label = (item: string) => question.content.options?.find((option) => option.id === item)?.text ?? item;
  return Array.isArray(value) ? value.map(label).join(' · ') : label(value);
}

function QuestionInput({ question, value, disabled, onChange }: {
  question: Question;
  value: Answers[string] | undefined;
  disabled: boolean;
  onChange: (value: Answers[string]) => void;
}) {
  if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
    const multiple = question.type === 'MULTIPLE_CHOICE';
    return <div className={styles.options}>
      {multiple && <Text role="body-sm" tone="muted">Birden fazla seçenek işaretleyebilirsiniz.</Text>}
      {question.content.options?.map((option) => {
        const selected = multiple ? Array.isArray(value) && value.includes(option.id) : value === option.id;
        return <label key={option.id} className={styles.option}>
          <input type={multiple ? 'checkbox' : 'radio'} name={question.id} checked={selected} disabled={disabled}
            onChange={() => {
              if (!multiple) return onChange(option.id);
              const current = Array.isArray(value) ? value : [];
              onChange(selected ? current.filter((id) => id !== option.id) : [...current, option.id]);
            }} />
          <span>{option.text}</span>
        </label>;
      })}
    </div>;
  }
  if (question.type === 'TRUE_FALSE') {
    return <div className={styles.options}>{[true, false].map((option) => <label key={String(option)} className={styles.option}>
      <input type="radio" name={question.id} checked={value === option} disabled={disabled} onChange={() => onChange(option)} />
      <span>{option ? 'Doğru' : 'Yanlış'}</span>
    </label>)}</div>;
  }
  if (question.type === 'FILL_BLANK') {
    return <div className={styles.options}>{Array.from({ length: question.content.blankCount ?? 1 }, (_, index) => <label key={index} className={styles.textLabel}>
      <span>{index + 1}. boşluk</span>
      <input className={styles.input} type="text" maxLength={200} disabled={disabled} value={Array.isArray(value) ? value[index] ?? '' : ''}
        onChange={(event) => {
          const values = Array.from({ length: question.content.blankCount ?? 1 }, (_, i) => Array.isArray(value) ? value[i] ?? '' : '');
          values[index] = event.target.value;
          onChange(values);
        }} />
    </label>)}</div>;
  }
  return <label className={styles.textLabel}>
    <span>Kısa yanıtınız</span>
    <input className={styles.input} type="text" maxLength={200} disabled={disabled} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} />
  </label>;
}

export function ExamAttemptPage() {
  const { examId = '' } = useParams();
  return <ExamAttempt key={examId} examId={examId} />;
}

function ExamAttempt({ examId }: { examId: string }) {
  const profile = useCurrentUser();
  const myExams = useMyExams();
  const current = useApiResource<{ attempt: StudentExamAttempt | null }>(profile.user ? `/api/v1/exams/${examId}/attempts/current` : null);
  const [attempt, setAttempt] = useState<StudentExamAttempt | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const answersRef = useRef<Answers>({});
  const submittingRef = useRef(false);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const activeAttemptId = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftWarning, setDraftWarning] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saved');
  const [confirm, setConfirm] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const expiryAttempt = useRef<string | null>(null);
  const exam = myExams.exams.find((item) => item.id === examId);

  useEffect(() => () => { activeAttemptId.current = null; }, []);

  useEffect(() => {
    if (myExams.serverTime) {
      const serverNow = Date.parse(myExams.serverTime);
      if (Number.isFinite(serverNow)) setClockOffset(serverNow - Date.now());
    }
  }, [myExams.serverTime]);

  const acceptAttempt = useCallback((next: StudentExamAttempt | null) => {
    if (next?.status === 'SUBMITTED' && profile.user) {
      try { localStorage.removeItem(draftKey(profile.user.id, next.id)); } catch { /* Browser storage can be disabled. */ }
    }
    const restored = next && profile.user && next.status === 'IN_PROGRESS'
      ? readDraft(draftKey(profile.user.id, next.id), next) : next?.answers ?? {};
    answersRef.current = restored;
    activeAttemptId.current = next?.id ?? null;
    setAnswers(restored);
    setAttempt(next);
  }, [profile.user]);

  useEffect(() => {
    if (current.data) acceptAttempt(current.data.attempt);
  }, [current.data, acceptAttempt]);

  useEffect(() => {
    if (!attempt || attempt.status !== 'IN_PROGRESS' || !profile.user) return;
    try {
      localStorage.setItem(draftKey(profile.user.id, attempt.id), JSON.stringify(answers));
      setDraftWarning(false);
    } catch {
      setDraftWarning(true);
    }
  }, [answers, attempt, profile.user]);

  useEffect(() => {
    if (!attempt || attempt.status !== 'IN_PROGRESS' || submittingRef.current) return;
    const attemptId = attempt.id;
    setSaveStatus('saving');
    // Serialize saves so a slow earlier request cannot overwrite a newer answer.
    const timer = window.setTimeout(() => {
      const snapshot = answersRef.current;
      saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
        if (activeAttemptId.current !== attemptId || submittingRef.current) return;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        try {
          const response = await apiFetch<{ attempt: StudentExamAttempt }>(`/api/v1/exams/${examId}/attempts/${attemptId}/answers`, {
            method: 'PUT', body: JSON.stringify({ answers: snapshot }), signal: controller.signal,
          });
          if (activeAttemptId.current !== attemptId) return;
          if (response.attempt.status === 'SUBMITTED') acceptAttempt(response.attempt);
          if (answersRef.current === snapshot) setSaveStatus('saved');
        } catch {
          if (activeAttemptId.current === attemptId) setSaveStatus('error');
        } finally {
          window.clearTimeout(timeout);
        }
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [answers, attempt, examId, acceptAttempt]);

  useEffect(() => {
    if (attempt?.status !== 'IN_PROGRESS' || !attempt.deadlineAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [attempt]);

  const submit = useCallback(async () => {
    if (!attempt || attempt.status !== 'IN_PROGRESS' || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await saveQueue.current.catch(() => undefined);
      const response = await apiFetch<{ attempt: StudentExamAttempt }>(`/api/v1/exams/${examId}/attempts/${attempt.id}/submit`, {
        method: 'POST', body: JSON.stringify({ answers: answersRef.current }),
      });
      acceptAttempt(response.attempt);
      setConfirm(false);
      myExams.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sınav gönderilemedi. Yanıtlarınızı yeniden gönderebilirsiniz.');
      throw err;
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }, [attempt, examId, profile.user, acceptAttempt, myExams.reload]);

  const remaining = attempt?.deadlineAt ? Math.max(0, Math.ceil((Date.parse(attempt.deadlineAt) - now - clockOffset) / 1000)) : null;
  const expired = attempt?.status === 'IN_PROGRESS' && remaining === 0;
  useEffect(() => {
    if (!expired || !attempt || expiryAttempt.current === attempt.id) return;
    expiryAttempt.current = attempt.id;
    setConfirm(false);
    void submit().catch(() => undefined);
  }, [expired, attempt, submit]);

  const start = async () => {
    if (busy || !exam?.canStart) return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch<{ attempt: StudentExamAttempt }>(`/api/v1/exams/${examId}/attempts`, { method: 'POST' });
      acceptAttempt(response.attempt);
      expiryAttempt.current = null;
      myExams.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sınav başlatılamadı.');
    } finally {
      setBusy(false);
    }
  };

  const loading = profile.loading || myExams.loading || current.loading || (!current.data && !current.error && !profile.error);
  const loadError = profile.error ?? current.error ?? myExams.error;
  const unanswered = attempt?.questions.filter((question) => !answered(question, answers[question.id])).length ?? 0;
  const objectives = attempt?.learningObjectives ?? exam?.learningObjectives ?? [];

  return <PageContainer>
    <Link to="/sinavlar" className={styles.backLink}>← Sınavlara dön</Link>
    <div className={styles.header}>
      <div>
        <Text role="headline-lg" as="h1">{attempt?.title ?? exam?.title ?? 'Eğitim sonu sınavı'}</Text>
        {exam && <Text role="body-md" tone="muted">{exam.course.title}</Text>}
      </div>
      {attempt?.status === 'IN_PROGRESS' && remaining !== null && <div className={styles.timer} role="timer" aria-label="Kalan sınav süresi">
        <Text role="label-md" tone={remaining < 60 ? 'error' : 'secondary'}>Kalan süre</Text>
        <Text role="title-md" tone={remaining < 60 ? 'error' : 'secondary'}>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</Text>
      </div>}
    </div>

    {loading && !attempt && <Text role="body-md" as="p">Sınav yükleniyor…</Text>}
    {loadError && <Card padding="lg"><div role="alert"><Text role="body-md" tone="error" as="p">{loadError}</Text></div>
      <Button variant="secondary" onClick={() => { void profile.reload(); current.reload(); myExams.reload(); }}>Yeniden dene</Button>
    </Card>}
    {error && <div className={styles.notice} role="alert"><Text role="body-md" tone="error">{error}</Text></div>}

    {!loading && !loadError && <>
      {objectives.length > 0 && <Card padding="lg">
        <Text role="title-md" as="h2">Bu sınavda ölçülen hedefler</Text>
        <ul className={styles.objectives}>{objectives.map((objective, index) => <li key={index}>{objective}</li>)}</ul>
      </Card>}

      {!attempt && exam && <Card padding="lg">
        <Text role="title-md" as="h2">Sınava hazır mısınız?</Text>
        {exam.description && <Text role="body-md" as="p" className={styles.preserveLines}>{exam.description}</Text>}
        <Text role="body-md" as="p">{exam.questionCount} soru · {formatDuration(exam.durationMinutes)} · {exam.attemptsUsed} / {exam.maxAttempts} deneme kullanıldı</Text>
        {exam.requiresCourseCompletion && <Text role="body-sm" tone="muted" as="p">Bu sınav için eğitimin tüm derslerini tamamlamalısınız.</Text>}
        <Text role="body-sm" tone="muted" as="p">Süre, aşağıdaki düğmeyle sınavı başlattığınızda işler. Sayfayı yenilerseniz devam eden denemeniz açılır.</Text>
        {exam.startBlockedReason && <Text role="body-md" tone="warning" as="p">{exam.startBlockedReason}</Text>}
        <Button disabled={!exam.canStart || busy} iconStart="play_arrow" onClick={() => void start()}>{busy ? 'Başlatılıyor…' : 'Sınavı başlat'}</Button>
      </Card>}
      {!attempt && !exam && <Text role="body-md" as="p">Bu sınav bulunamadı veya size atanmamış.</Text>}

      {attempt?.status === 'IN_PROGRESS' && <>
        <div className={styles.progress}>
          <Text role="body-md">{attempt.questions.length - unanswered} / {attempt.questions.length} soru yanıtlandı</Text>
          <Text role="body-sm" tone={saveStatus === 'error' ? 'warning' : 'muted'}>
            {saveStatus === 'error' ? 'Sunucuya kaydedilemedi. Bağlantınızı kontrol edin; süre dolmadan sınavı gönderin.' : saveStatus === 'saving' ? 'Yanıtlar kaydediliyor…' : 'Yanıtlar sunucuya kaydedildi.'}
          </Text>
        </div>
        {draftWarning && <Text role="body-sm" tone="warning" as="p">Bu tarayıcıda taslak kaydedilemiyor. Sayfayı kapatmadan yanıtların sunucuya kaydedilmesini bekleyin.</Text>}
        {expired && <div className={styles.notice} role="status"><Text role="body-md" tone="warning">Süreniz doldu. Mevcut yanıtlarınız gönderiliyor. Gönderim başarısız olursa aşağıdaki düğmeyle yeniden deneyebilirsiniz.</Text></div>}
        <form className={styles.questions} onSubmit={(event) => { event.preventDefault(); if (expired) void submit().catch(() => undefined); else setConfirm(true); }}>
          {attempt.questions.map((question, index) => <Card key={question.id} padding="lg" as="fieldset" className={styles.question}>
            <legend className={styles.legend}>{index + 1}. soru · {question.points} puan</legend>
            <Text role="body-lg" as="p" className={styles.preserveLines}>{question.stem}</Text>
            <QuestionInput question={question} value={answers[question.id]} disabled={busy || expired}
              onChange={(value) => {
                const next = { ...answersRef.current, [question.id]: value };
                answersRef.current = next;
                setAnswers(next);
              }} />
          </Card>)}
          <div className={styles.submitBar}>
            <Text role="body-sm" tone="muted">{unanswered ? `${unanswered} soru henüz yanıtlanmadı.` : 'Tüm sorular yanıtlandı.'}</Text>
            <Button type="submit" disabled={busy} iconStart="task_alt">{busy ? 'Gönderiliyor…' : expired ? 'Yanıtları yeniden gönder' : 'Sınavı tamamla'}</Button>
          </div>
        </form>
      </>}

      {attempt?.status === 'SUBMITTED' && <>
        <Card padding="lg" className={styles.result}>
          <Text role="title-md" as="h2">Sınav tamamlandı</Text>
          {attempt.submittedAt && <Text role="body-sm" tone="muted">Gönderim: {formatDateTime(attempt.submittedAt)}</Text>}
          {attempt.result ? <>
            <Text role="headline-lg" as="p">%{attempt.result.score}</Text>
            <Text role="body-md">{attempt.result.earnedPoints} / {attempt.result.totalPoints} puan</Text>
            {attempt.result.passed !== null && <Badge tone={attempt.result.passed ? 'success' : 'warning'}>{attempt.result.passed ? 'Başarılı' : 'Geçme notunun altında'}</Badge>}
          </> : <Text role="body-md" as="p">Yanıtlarınız kaydedildi. Sınav yöneticisi sonuçları paylaşmadığı için puanınız şu an gösterilmiyor.</Text>}
          {exam?.canStart && <Button disabled={busy} variant="secondary" onClick={() => void start()}>{busy ? 'Başlatılıyor…' : `Yeni deneme başlat (${exam.maxAttempts - exam.attemptsUsed} hak)`}</Button>}
          {exam?.startBlockedReason && <Text role="body-sm" tone="muted">{exam.startBlockedReason}</Text>}
        </Card>
        {attempt.result?.feedback && <section className={styles.questions} aria-label="Soru geri bildirimleri">
          <Text role="title-md" as="h2">Yanıtlarınız ve geri bildirim</Text>
          {attempt.questions.map((question, index) => {
            const feedback = attempt.result?.feedback?.find((item) => item.questionId === question.id);
            if (!feedback) return null;
            return <Card padding="lg" key={question.id}>
              <Badge tone={feedback.correct ? 'success' : 'warning'}>{feedback.correct ? 'Doğru' : 'Yanlış'}</Badge>
              <Text role="body-lg" as="p" className={styles.preserveLines}>{index + 1}. {question.stem}</Text>
              <Text role="body-md" as="p">Yanıtınız: {answerLabel(question, attempt.answers[question.id])}</Text>
              {!feedback.correct && <Text role="body-md" as="p">Doğru yanıt: {answerLabel(question, feedback.correctAnswer)}</Text>}
              {feedback.explanation && <Text role="body-sm" tone="muted" as="p" className={styles.preserveLines}>{feedback.explanation}</Text>}
            </Card>;
          })}
        </section>}
      </>}
    </>}
    {confirm && <ConfirmDialog title="Sınavı tamamla" confirmLabel="Yanıtları gönder" onClose={() => setConfirm(false)} onConfirm={submit}>
      <Text role="body-md" as="p">{unanswered ? `${unanswered} soru yanıtsız. Yine de sınavı tamamlamak istiyor musunuz?` : 'Yanıtlarınızı göndermek istiyor musunuz?'} Gönderilen yanıtlar değiştirilemez.</Text>
    </ConfirmDialog>}
  </PageContainer>;
}

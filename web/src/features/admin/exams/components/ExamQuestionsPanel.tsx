import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Badge, Button, Card, IconButton, Text } from '../../../../components';
import type { ExamDetail, ExamQuestionLink } from '../../../../types';
import { QuestionPreview } from '../../question-banks/components/QuestionPreview';
import { DIFFICULTIES, QUESTION_TYPES } from '../../question-banks/questionMeta';
import {
  addExamQuestions,
  removeExamQuestion,
  reorderExamQuestions,
  updateExamQuestionPoints,
} from '../data/examApi';
import { QuestionPickerDialog } from './QuestionPickerDialog';
import styles from './ExamQuestionsPanel.module.css';

/** Sınava özgü puan: odak kaybında ya da Enter'da, değiştiyse kaydedilir. */
function PointsInput({ link, disabled, onSave }: { link: ExamQuestionLink; disabled: boolean; onSave: (points: number) => void }) {
  const [value, setValue] = useState(String(link.points));
  const [invalid, setInvalid] = useState(false);

  const commit = () => {
    const points = Number(value);
    if (!Number.isInteger(points) || points < 1 || points > 100) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (points !== link.points) onSave(points);
  };

  return (
    <label className={styles.points}>
      <input
        type="number"
        min={1}
        max={100}
        value={value}
        disabled={disabled}
        aria-invalid={invalid}
        aria-label={`${link.position}. sorunun puanı`}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
      />
      <Text role="label-md" tone="muted" as="span">
        puan
      </Text>
    </label>
  );
}

interface ExamQuestionsPanelProps {
  detail: ExamDetail;
  onDetailChange: (detail: ExamDetail) => void;
}

export function ExamQuestionsPanel({ detail, onDetailChange }: ExamQuestionsPanelProps) {
  const { exam, questions } = detail;
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<ExamDetail>) => {
    setBusy(true);
    setError(null);
    try {
      onDetailChange(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  };

  const move = (index: number, delta: -1 | 1) => {
    const ids = questions.map((q) => q.questionId);
    const target = index + delta;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(() => reorderExamQuestions(exam.id, ids));
  };

  return (
    <div className={styles.panel}>
      <div className={styles.summary}>
        <div>
          <Text role="title-md" as="h2">
            {questions.length} soru · toplam {exam.totalPoints} puan
          </Text>
          {exam.randomQuestionCount !== null && (
            <Text role="body-sm" tone="muted" as="p">
              Her öğrenciye bu sorulardan rastgele {exam.randomQuestionCount} tanesi sorulur.
            </Text>
          )}
        </div>
        <Button variant="primary" iconStart="playlist_add" onClick={() => setPicking(true)}>
          Bankadan soru ekle
        </Button>
      </div>

      <div aria-live="polite">
        {error && (
          <div className={styles.error} role="alert">
            <Text role="body-sm" tone="error" as="p">
              {error}
            </Text>
          </div>
        )}
      </div>

      {questions.length === 0 ? (
        <Card padding="lg" elevation="1">
          <Text role="body-md" tone="muted" as="p">
            Sınavda henüz soru yok. "Bankadan soru ekle" ile kursun ve genel bankaların sorularından seçin.
          </Text>
        </Card>
      ) : (
        <ol className={styles.list}>
          {questions.map((link, index) => {
            const { question } = link;
            return (
              <li key={link.questionId}>
                <Card padding="md" elevation="1" className={styles.item}>
                  <div className={styles.order}>
                    <IconButton
                      icon="arrow_upward"
                      label={`${link.position}. soruyu yukarı taşı`}
                      disabled={busy || index === 0}
                      onClick={() => move(index, -1)}
                    />
                    <span className={styles.position} aria-hidden="true">
                      {link.position}
                    </span>
                    <IconButton
                      icon="arrow_downward"
                      label={`${link.position}. soruyu aşağı taşı`}
                      disabled={busy || index === questions.length - 1}
                      onClick={() => move(index, 1)}
                    />
                  </div>

                  <div className={styles.body}>
                    <span className={styles.badges}>
                      <Badge tone="secondary" icon={QUESTION_TYPES[question.type].icon}>
                        {QUESTION_TYPES[question.type].short}
                      </Badge>
                      <Badge tone={DIFFICULTIES[question.difficulty].tone} variant="soft">
                        {DIFFICULTIES[question.difficulty].label}
                      </Badge>
                      {question.topic && <Badge tone="neutral">{question.topic}</Badge>}
                      <Badge tone="muted" icon="library_books">
                        {question.bank.name}
                      </Badge>
                    </span>
                    <details className={styles.details}>
                      <summary>
                        <Text role="body-md" as="span" tone="main" className={styles.stem}>
                          {question.stem}
                        </Text>
                      </summary>
                      <div className={styles.preview}>
                        <QuestionPreview question={question} />
                      </div>
                    </details>
                  </div>

                  <div className={styles.side}>
                    <PointsInput
                      key={`${link.questionId}:${link.points}`}
                      link={link}
                      disabled={busy}
                      onSave={(points) => void run(() => updateExamQuestionPoints(exam.id, link.questionId, points))}
                    />
                    <IconButton
                      icon="remove_circle_outline"
                      label={`${link.position}. soruyu sınavdan çıkar`}
                      disabled={busy}
                      onClick={() => void run(() => removeExamQuestion(exam.id, link.questionId))}
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      {picking && (
        <QuestionPickerDialog
          courseId={exam.course.id}
          existingIds={new Set(questions.map((q) => q.questionId))}
          onClose={() => setPicking(false)}
          onAdd={async (ids) => {
            onDetailChange(await addExamQuestions(exam.id, ids));
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

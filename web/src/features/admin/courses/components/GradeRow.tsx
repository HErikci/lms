import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Avatar, Button, Card, Text } from '../../../../components';
import { describeGradeError } from '../data/useLessonGrades';
import type { LessonGradeRow } from '../data/useLessonGrades';
import styles from './GradeRow.module.css';

interface GradeRowProps {
  row: LessonGradeRow;
  onSave: (studentId: string, score: number) => Promise<void>;
  onDelete: (studentId: string) => Promise<void>;
}

type Pending = 'save' | 'delete' | null;

const INVALID_SCORE_MESSAGE = 'Not 0 ile 100 arasında bir tam sayı olmalıdır.';

/** Tek öğrencinin not satırı: 0–100 arası not girişi, kaydet ve (not varsa) sil eylemleri. */
export function GradeRow({ row, onSave, onDelete }: GradeRowProps) {
  const { student } = row;
  const errorId = useId();
  const [value, setValue] = useState(row.score === null ? '' : String(row.score));
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const unchanged = row.score !== null && trimmed === String(row.score);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || unchanged) return;

    const score = Number(trimmed);
    if (trimmed === '' || !Number.isInteger(score) || score < 0 || score > 100) {
      setError(INVALID_SCORE_MESSAGE);
      return;
    }

    setPending('save');
    setError(null);
    try {
      await onSave(student.id, score);
      setValue(String(score));
    } catch (err) {
      setError(describeGradeError(err, 'Not kaydedilemedi.'));
    } finally {
      setPending(null);
    }
  };

  const handleDelete = async () => {
    if (pending) return;
    setPending('delete');
    setError(null);
    try {
      await onDelete(student.id);
      setValue('');
    } catch (err) {
      setError(describeGradeError(err, 'Not silinemedi.'));
    } finally {
      setPending(null);
    }
  };

  return (
    <Card padding="md" elevation="1">
      <div className={styles.row}>
        <div className={styles.student}>
          <Avatar name={student.name} src={student.avatarUrl ?? undefined} />
          <div className={styles.studentInfo}>
            <Text role="title-md" as="p" tone="main" className={styles.wrap}>
              {student.name}
            </Text>
            <Text role="body-sm" as="p" tone="muted" className={styles.wrap}>
              {student.email}
            </Text>
          </div>
        </div>

        <div className={styles.gradeBlock}>
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <span className={styles.scoreField}>
              <input
                className={styles.input}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setError(null);
                }}
                readOnly={pending !== null}
                aria-label={`${student.name} notu`}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
              <Text role="body-md" tone="muted" as="span">
                / 100
              </Text>
            </span>
            <Button type="submit" variant="primary" size="sm" disabled={pending !== null || unchanged}>
              {pending === 'save' ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
            {row.score !== null && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                iconStart="delete"
                disabled={pending !== null}
                onClick={handleDelete}
              >
                {pending === 'delete' ? 'Siliniyor…' : 'Notu sil'}
              </Button>
            )}
          </form>

          <div role="status">
            <Text role="body-sm" tone="muted" as="p">
              {row.gradedAt
                ? `Son güncelleme: ${new Date(row.gradedAt).toLocaleDateString('tr-TR')}`
                : 'Not girilmedi'}
            </Text>
          </div>
        </div>
      </div>

      {error && (
        <div id={errorId} role="alert" className={styles.error}>
          <Text role="body-sm" tone="error" as="p">
            {error}
          </Text>
        </div>
      )}
    </Card>
  );
}

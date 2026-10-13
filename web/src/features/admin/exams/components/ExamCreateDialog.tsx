import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Dialog, Text, formStyles } from '../../../../components';
import type { ExamType } from '../../../../types';
import { EXAM_TYPES, EXAM_TYPE_KEYS } from '../../../exams/examMeta';
import type { NewExamInput } from '../data/examApi';

interface ExamCreateDialogProps {
  courses: { id: string; title: string }[];
  onCreate: (input: NewExamInput) => Promise<void>;
  onClose: () => void;
}

export function ExamCreateDialog({ courses, onCreate, onClose }: ExamCreateDialogProps) {
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [type, setType] = useState<ExamType>('QUIZ');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Kurs listesi diyalog açıldıktan sonra gelebilir: seçim yapılmadıysa ilk kurs varsayılır.
  const selectedCourseId = courseId || (courses[0]?.id ?? '');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) return setError('Sınav adı zorunludur.');
    if (!selectedCourseId) return setError('Bir kurs seçmelisiniz.');
    setBusy(true);
    setError(null);
    try {
      await onCreate({ title: title.trim(), courseId: selectedCourseId, type, description: description.trim() || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sınav oluşturulamadı.');
      setBusy(false);
    }
  };

  return (
    <Dialog title="Yeni Sınav" busy={busy} onClose={onClose}>
      <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
        <label className={formStyles.field}>
          <Text role="label-md" as="span" tone="muted">
            Sınav adı
          </Text>
          <input
            className={formStyles.input}
            type="text"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            required
            aria-required="true"
          />
        </label>

        <div className={formStyles.row}>
          <label className={formStyles.field}>
            <Text role="label-md" as="span" tone="muted">
              Kurs
            </Text>
            <select className={formStyles.input} value={selectedCourseId} onChange={(event) => setCourseId(event.target.value)}>
              {courses.length === 0 && <option value="">Yönetebildiğiniz kurs yok</option>}
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>
          <label className={formStyles.field}>
            <Text role="label-md" as="span" tone="muted">
              Tür
            </Text>
            <select className={formStyles.input} value={type} onChange={(event) => setType(event.target.value as ExamType)}>
              {EXAM_TYPE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {EXAM_TYPES[key].label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Text role="body-sm" as="p" tone="muted">
          Sınavın kursu sonradan değiştirilemez. Zamanlama, süre ve diğer ayarları bir sonraki adımda yapacaksınız.
        </Text>

        <label className={formStyles.field}>
          <Text role="label-md" as="span" tone="muted">
            Açıklama (isteğe bağlı)
          </Text>
          <textarea
            className={formStyles.textarea}
            rows={3}
            maxLength={5000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        {error && (
          <div className={formStyles.error} role="alert">
            <Text role="body-sm" tone="error" as="p">
              {error}
            </Text>
          </div>
        )}

        <div className={formStyles.actions}>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            İptal
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Oluşturuluyor…' : 'Oluştur ve düzenle'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

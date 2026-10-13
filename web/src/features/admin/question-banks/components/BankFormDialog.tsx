import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Dialog, Text, formStyles } from '../../../../components';
import type { QuestionBank } from '../../../../types';
import type { BankInput } from '../data/questionBankApi';

export interface CourseOption {
  id: string;
  title: string;
}

interface BankFormDialogProps {
  /** Düzenlenen banka; yoksa yeni banka. */
  bank: QuestionBank | null;
  courses: CourseOption[];
  /** Yalnızca ADMIN genel banka oluşturabilir. */
  canCreateGeneral: boolean;
  onSave: (input: BankInput) => Promise<void>;
  onClose: () => void;
}

export function BankFormDialog({ bank, courses, canCreateGeneral, onSave, onClose }: BankFormDialogProps) {
  const [name, setName] = useState(bank?.name ?? '');
  const [description, setDescription] = useState(bank?.description ?? '');
  const [courseId, setCourseId] = useState('');
  // Kurs listesi diyalog açıldıktan sonra gelebilir: seçim yapılmadıysa eğitmen için ilk kurs varsayılır.
  const selectedCourseId = courseId || (canCreateGeneral ? '' : (courses[0]?.id ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Banka adı zorunludur.');
      return;
    }
    if (!bank && !canCreateGeneral && !selectedCourseId) {
      setError('Bir kurs seçmelisiniz.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        ...(bank ? {} : { courseId: selectedCourseId || null }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Banka kaydedilemedi.');
      setBusy(false);
    }
  };

  return (
    <Dialog title={bank ? 'Bankayı Düzenle' : 'Yeni Soru Bankası'} busy={busy} onClose={onClose}>
      <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
        <label className={formStyles.field}>
          <Text role="label-md" as="span" tone="muted">
            Banka adı
          </Text>
          <input
            className={formStyles.input}
            type="text"
            value={name}
            maxLength={150}
            onChange={(event) => setName(event.target.value)}
            required
            aria-required="true"
          />
        </label>

        <label className={formStyles.field}>
          <Text role="label-md" as="span" tone="muted">
            Kurs
          </Text>
          {bank ? (
            <>
              <input className={formStyles.input} type="text" value={bank.course?.title ?? 'Genel (tüm kurslar)'} disabled />
              <Text role="body-sm" as="span" tone="muted">
                Bankanın kursu sonradan değiştirilemez.
              </Text>
            </>
          ) : (
            <>
              <select className={formStyles.input} value={selectedCourseId} onChange={(event) => setCourseId(event.target.value)}>
                {canCreateGeneral && <option value="">Genel (tüm kursların sınavlarında kullanılabilir)</option>}
                {!canCreateGeneral && courses.length === 0 && <option value="">Eğitmeni olduğunuz kurs yok</option>}
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
              <Text role="body-sm" as="span" tone="muted">
                Kurs bankasının soruları yalnızca o kursun sınavlarında kullanılabilir.
              </Text>
            </>
          )}
        </label>

        <label className={formStyles.field}>
          <Text role="label-md" as="span" tone="muted">
            Açıklama (isteğe bağlı)
          </Text>
          <textarea
            className={formStyles.textarea}
            rows={3}
            maxLength={2000}
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
            {busy ? 'Kaydediliyor…' : bank ? 'Kaydet' : 'Bankayı Oluştur'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

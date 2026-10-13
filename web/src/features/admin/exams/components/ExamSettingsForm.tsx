import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Text, formStyles } from '../../../../components';
import type { ExamSettings, ExamType, ManagedExam } from '../../../../types';
import { toDateTimeInput } from '../../../calendar/dateUtils';
import { EXAM_TYPES, EXAM_TYPE_KEYS } from '../../../exams/examMeta';

interface FormState {
  title: string;
  type: ExamType;
  description: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: string;
  maxAttempts: string;
  passingScore: string;
  randomQuestionCount: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResults: boolean;
}

const toLocal = (iso: string | null) => (iso ? toDateTimeInput(new Date(iso)) : '');
const toText = (value: number | null) => (value === null ? '' : String(value));

function fromExam(exam: ManagedExam): FormState {
  return {
    title: exam.title,
    type: exam.type,
    description: exam.description ?? '',
    startsAt: toLocal(exam.startsAt),
    endsAt: toLocal(exam.endsAt),
    durationMinutes: toText(exam.durationMinutes),
    maxAttempts: String(exam.maxAttempts),
    passingScore: toText(exam.passingScore),
    randomQuestionCount: toText(exam.randomQuestionCount),
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
    showResults: exam.showResults,
  };
}

/** Boş metin = null; aksi halde [min, max] aralığında tam sayı olmalı. */
function parseOptionalInt(value: string, label: string, min: number, max: number): number | null | string {
  if (value.trim() === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return `${label} ${min} ile ${max} arasında bir tam sayı olmalıdır.`;
  return n;
}

function toPatch(state: FormState): Partial<ExamSettings> | string {
  if (!state.title.trim()) return 'Sınav adı zorunludur.';
  const startsAt = state.startsAt ? new Date(state.startsAt) : null;
  const endsAt = state.endsAt ? new Date(state.endsAt) : null;
  if (startsAt && endsAt && endsAt <= startsAt) return 'Bitiş zamanı başlangıçtan sonra olmalıdır.';

  const duration = parseOptionalInt(state.durationMinutes, 'Süre', 1, 600);
  if (typeof duration === 'string') return duration;
  if (duration !== null && startsAt && endsAt && duration > (endsAt.getTime() - startsAt.getTime()) / 60000) {
    return 'Sınav süresi, başlangıç ile bitiş arasındaki süreden uzun olamaz.';
  }
  const attempts = parseOptionalInt(state.maxAttempts, 'Deneme hakkı', 1, 10);
  if (typeof attempts === 'string') return attempts;
  const passing = parseOptionalInt(state.passingScore, 'Geçme notu', 0, 100);
  if (typeof passing === 'string') return passing;
  const random = parseOptionalInt(state.randomQuestionCount, 'Rastgele soru sayısı', 1, 1000);
  if (typeof random === 'string') return random;

  return {
    title: state.title.trim(),
    type: state.type,
    description: state.description.trim() || null,
    startsAt: startsAt?.toISOString() ?? null,
    endsAt: endsAt?.toISOString() ?? null,
    durationMinutes: duration,
    maxAttempts: attempts ?? 1,
    passingScore: passing,
    randomQuestionCount: random,
    shuffleQuestions: state.shuffleQuestions,
    shuffleOptions: state.shuffleOptions,
    showResults: state.showResults,
  };
}

interface ExamSettingsFormProps {
  exam: ManagedExam;
  questionCount: number;
  onSave: (patch: Partial<ExamSettings>) => Promise<void>;
}

export function ExamSettingsForm({ exam, questionCount, onSave }: ExamSettingsFormProps) {
  const [state, setState] = useState<FormState>(() => fromExam(exam));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Sunucu kaydı değiştiğinde (kaydetme sonrası normalleştirilmiş değerler dahil) form onunla eşitlenir;
  // bağımlılık bilinçli olarak yalnızca kayıt sürümüdür.
  useEffect(() => {
    setState(fromExam(exam));
  }, [exam.updatedAt]);

  const dirty = JSON.stringify(state) !== JSON.stringify(fromExam(exam));
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
    setNotice(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const patch = toPatch(state);
    if (typeof patch === 'string') {
      setError(patch);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(patch);
      setNotice('Ayarlar kaydedildi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ayarlar kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
      <div className={formStyles.row}>
        <label className={formStyles.field}>
          <Text role="label-md" as="span" tone="muted">
            Sınav adı
          </Text>
          <input
            className={formStyles.input}
            type="text"
            value={state.title}
            maxLength={200}
            onChange={(event) => set('title', event.target.value)}
            required
            aria-required="true"
          />
        </label>
        <label className={formStyles.field}>
          <Text role="label-md" as="span" tone="muted">
            Tür
          </Text>
          <select className={formStyles.input} value={state.type} onChange={(event) => set('type', event.target.value as ExamType)}>
            {EXAM_TYPE_KEYS.map((key) => (
              <option key={key} value={key}>
                {EXAM_TYPES[key].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={formStyles.field}>
        <Text role="label-md" as="span" tone="muted">
          Açıklama / kapsam
        </Text>
        <textarea
          className={formStyles.textarea}
          rows={3}
          maxLength={5000}
          value={state.description}
          placeholder="ör. Modül 1–4: Hooks, JSX ve listeler"
          onChange={(event) => set('description', event.target.value)}
        />
      </label>

      <fieldset className={formStyles.fieldset}>
        <legend>
          <Text role="label-lg" as="span">
            Zamanlama
          </Text>
        </legend>
        <div className={formStyles.row3}>
          <label className={formStyles.field}>
            <Text role="label-md" as="span" tone="muted">
              Başlangıç
            </Text>
            <input
              className={formStyles.input}
              type="datetime-local"
              value={state.startsAt}
              onChange={(event) => set('startsAt', event.target.value)}
            />
          </label>
          <label className={formStyles.field}>
            <Text role="label-md" as="span" tone="muted">
              Bitiş
            </Text>
            <input
              className={formStyles.input}
              type="datetime-local"
              value={state.endsAt}
              min={state.startsAt || undefined}
              onChange={(event) => set('endsAt', event.target.value)}
            />
          </label>
          <label className={formStyles.field}>
            <Text role="label-md" as="span" tone="muted">
              Süre (dakika)
            </Text>
            <input
              className={formStyles.input}
              type="number"
              min={1}
              max={600}
              value={state.durationMinutes}
              placeholder="Sınırsız"
              onChange={(event) => set('durationMinutes', event.target.value)}
            />
          </label>
        </div>
        <Text role="body-sm" as="p" tone="muted">
          Başlangıç ve bitiş, sınavın açık olduğu aralıktır; süre, öğrencinin sınavı başlattıktan sonraki süresidir. Boş
          bırakılan alan sınır koymaz.
        </Text>
      </fieldset>

      <fieldset className={formStyles.fieldset}>
        <legend>
          <Text role="label-lg" as="span">
            Değerlendirme
          </Text>
        </legend>
        <div className={formStyles.row3}>
          <label className={formStyles.field}>
            <Text role="label-md" as="span" tone="muted">
              Deneme hakkı
            </Text>
            <input
              className={formStyles.input}
              type="number"
              min={1}
              max={10}
              value={state.maxAttempts}
              onChange={(event) => set('maxAttempts', event.target.value)}
            />
          </label>
          <label className={formStyles.field}>
            <Text role="label-md" as="span" tone="muted">
              Geçme notu (%)
            </Text>
            <input
              className={formStyles.input}
              type="number"
              min={0}
              max={100}
              value={state.passingScore}
              placeholder="Yok"
              onChange={(event) => set('passingScore', event.target.value)}
            />
          </label>
          <label className={formStyles.field}>
            <Text role="label-md" as="span" tone="muted">
              Rastgele soru sayısı
            </Text>
            <input
              className={formStyles.input}
              type="number"
              min={1}
              value={state.randomQuestionCount}
              placeholder="Tüm sorular"
              onChange={(event) => set('randomQuestionCount', event.target.value)}
            />
          </label>
        </div>
        <Text role="body-sm" as="p" tone="muted">
          Rastgele soru sayısı girilirse her öğrenciye sınavdaki {questionCount} sorudan bu kadarı rastgele sorulur; boş
          bırakılırsa tüm sorular sorulur.
        </Text>
      </fieldset>

      <fieldset className={formStyles.fieldset}>
        <legend>
          <Text role="label-lg" as="span">
            Sınav davranışı
          </Text>
        </legend>
        <label className={formStyles.checkbox}>
          <input
            type="checkbox"
            checked={state.shuffleQuestions}
            onChange={(event) => set('shuffleQuestions', event.target.checked)}
          />
          <Text role="body-md" as="span">
            Soruların sırasını her öğrenci için karıştır
          </Text>
        </label>
        <label className={formStyles.checkbox}>
          <input
            type="checkbox"
            checked={state.shuffleOptions}
            onChange={(event) => set('shuffleOptions', event.target.checked)}
          />
          <Text role="body-md" as="span">
            Seçeneklerin sırasını karıştır
          </Text>
        </label>
        <label className={formStyles.checkbox}>
          <input type="checkbox" checked={state.showResults} onChange={(event) => set('showResults', event.target.checked)} />
          <Text role="body-md" as="span">
            Sınav bitince doğru cevapları ve açıklamaları göster
          </Text>
        </label>
      </fieldset>

      <div aria-live="polite">
        {error && (
          <div className={formStyles.error} role="alert">
            <Text role="body-sm" tone="error" as="p">
              {error}
            </Text>
          </div>
        )}
        {notice && !dirty && (
          <div className={formStyles.success}>
            <Text role="body-sm" tone="success" as="p">
              {notice}
            </Text>
          </div>
        )}
      </div>

      <div className={formStyles.actions}>
        <Button
          variant="ghost"
          disabled={!dirty || busy}
          onClick={() => {
            setState(fromExam(exam));
            setError(null);
          }}
        >
          Değişiklikleri geri al
        </Button>
        <Button type="submit" variant="primary" disabled={!dirty || busy}>
          {busy ? 'Kaydediliyor…' : 'Ayarları kaydet'}
        </Button>
      </div>
    </form>
  );
}

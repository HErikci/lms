import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Dialog, IconButton, Text, formStyles } from '../../../../components';
import type { BankQuestion, QuestionDifficulty, QuestionType, TypedQuestionContent } from '../../../../types';
import type { QuestionPayload } from '../data/questionBankApi';
import { DIFFICULTIES, DIFFICULTY_KEYS, QUESTION_TYPES, QUESTION_TYPE_KEYS, countBlanks } from '../questionMeta';
import { QuestionPreview } from './QuestionPreview';
import styles from './QuestionFormDialog.module.css';

const MAX_OPTIONS = 10;
const MIN_OPTIONS = 2;
const MAX_PAIRS = 20;
const MIN_PAIRS = 2;

let keySeed = 0;
const newKey = () => `k${++keySeed}`;

interface OptionDraft {
  key: string;
  /** Kayıtlı seçeneğin kimliği; yeni seçenekte boş (sunucu üretir). */
  id?: string;
  text: string;
  correct: boolean;
}

interface PairDraft {
  key: string;
  id?: string;
  left: string;
  right: string;
}

const blankOptions = (count: number): OptionDraft[] =>
  Array.from({ length: count }, () => ({ key: newKey(), text: '', correct: false }));
const blankPairs = (count: number): PairDraft[] =>
  Array.from({ length: count }, () => ({ key: newKey(), left: '', right: '' }));

const splitComma = (value: string) => value.split(',').map((s) => s.trim()).filter(Boolean);
const splitLines = (value: string) => value.split('\n').map((s) => s.trim()).filter(Boolean);

type PreviewQuestion = TypedQuestionContent & { stem: string; explanation: string | null };

/** Önizleme için yeni seçenek/çiftlere geçici kimlik verir. */
function toPreview(payload: QuestionPayload): PreviewQuestion {
  const withIds = <T extends { id?: string }>(items: T[], prefix: string) =>
    items.map((item, index) => ({ ...item, id: item.id ?? `${prefix}${index}` }));
  switch (payload.type) {
    case 'SINGLE_CHOICE':
      return { ...payload, content: { options: withIds(payload.content.options, 'o') } };
    case 'MULTIPLE_CHOICE':
      return { ...payload, content: { options: withIds(payload.content.options, 'o') } };
    case 'MATCHING':
      return { ...payload, content: { pairs: withIds(payload.content.pairs, 'p') } };
    default:
      return payload;
  }
}

interface QuestionFormDialogProps {
  /** Düzenlenen soru; yoksa yeni soru. */
  question: BankQuestion | null;
  /** Konu alanı için bankadaki mevcut konular. */
  topicSuggestions: string[];
  onSave: (payload: QuestionPayload) => Promise<void>;
  onClose: () => void;
}

export function QuestionFormDialog({ question, topicSuggestions, onSave, onClose }: QuestionFormDialogProps) {
  const uid = useId();
  const stemRef = useRef<HTMLTextAreaElement>(null);
  const c = question;

  const [type, setType] = useState<QuestionType>(c?.type ?? 'SINGLE_CHOICE');
  const [stem, setStem] = useState(c?.stem ?? '');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(c?.difficulty ?? 'MEDIUM');
  const [points, setPoints] = useState(String(c?.points ?? 1));
  const [topic, setTopic] = useState(c?.topic ?? '');
  const [explanation, setExplanation] = useState(c?.explanation ?? '');

  // Her tipin taslağı ayrı tutulur: tip değiştirilince girilenler kaybolmaz.
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    c?.type === 'SINGLE_CHOICE' || c?.type === 'MULTIPLE_CHOICE'
      ? c.content.options.map((o) => ({ key: newKey(), id: o.id, text: o.text, correct: o.correct }))
      : blankOptions(4),
  );
  const [correctAnswer, setCorrectAnswer] = useState<boolean | null>(
    c?.type === 'TRUE_FALSE' ? c.content.correctAnswer : null,
  );
  const [blankAnswers, setBlankAnswers] = useState<string[]>(
    c?.type === 'FILL_BLANK' ? c.content.blanks.map((b) => b.accepted.join(', ')) : [],
  );
  const [caseSensitive, setCaseSensitive] = useState(
    c?.type === 'FILL_BLANK' || c?.type === 'SHORT_ANSWER' ? c.content.caseSensitive : false,
  );
  const [pairs, setPairs] = useState<PairDraft[]>(() =>
    c?.type === 'MATCHING' ? c.content.pairs.map((p) => ({ key: newKey(), ...p })) : blankPairs(3),
  );
  const [shortAnswers, setShortAnswers] = useState(c?.type === 'SHORT_ANSWER' ? c.content.accepted.join('\n') : '');
  const [rubric, setRubric] = useState(c?.type === 'ESSAY' ? (c.content.rubric ?? '') : '');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const blankCount = countBlanks(stem);

  const changeType = (next: QuestionType) => {
    // Tek cevaplıya geçerken birden çok doğru işaretliyse yalnızca ilki kalır.
    if (next === 'SINGLE_CHOICE' && options.filter((o) => o.correct).length > 1) {
      let seen = false;
      setOptions((prev) =>
        prev.map((o) => {
          const keep = o.correct && !seen;
          if (o.correct) seen = true;
          return { ...o, correct: keep };
        }),
      );
    }
    setType(next);
  };

  const updateOption = (key: string, patch: Partial<OptionDraft>) =>
    setOptions((prev) => prev.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  const markCorrect = (key: string, checked: boolean) =>
    setOptions((prev) =>
      prev.map((o) => (type === 'SINGLE_CHOICE' ? { ...o, correct: o.key === key } : o.key === key ? { ...o, correct: checked } : o)),
    );
  const updatePair = (key: string, patch: Partial<PairDraft>) =>
    setPairs((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const insertBlank = () => {
    const el = stemRef.current;
    const start = el?.selectionStart ?? stem.length;
    const end = el?.selectionEnd ?? stem.length;
    const before = stem.slice(0, start);
    const insert = `${before && !before.endsWith(' ') ? ' ' : ''}___ `;
    setStem(before + insert + stem.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + insert.length, start + insert.length);
    });
  };

  const buildPayload = (): QuestionPayload | string => {
    if (!stem.trim()) return 'Soru metni zorunludur.';
    const pointsValue = Number(points);
    if (!Number.isInteger(pointsValue) || pointsValue < 1 || pointsValue > 100) return 'Puan 1 ile 100 arasında bir tam sayı olmalıdır.';
    const base = {
      stem: stem.trim(),
      explanation: explanation.trim() || null,
      topic: topic.trim() || null,
      difficulty,
      points: pointsValue,
    };

    switch (type) {
      case 'SINGLE_CHOICE':
      case 'MULTIPLE_CHOICE': {
        const filled = options.filter((o) => o.text.trim());
        if (filled.length < MIN_OPTIONS) return 'En az iki seçenek girin.';
        const correctCount = filled.filter((o) => o.correct).length;
        if (type === 'SINGLE_CHOICE' && correctCount !== 1) return 'Doğru cevap olarak bir seçenek işaretleyin.';
        if (type === 'MULTIPLE_CHOICE' && correctCount < 1) return 'En az bir doğru seçenek işaretleyin.';
        return {
          ...base,
          type,
          content: { options: filled.map((o) => ({ id: o.id, text: o.text.trim(), correct: o.correct })) },
        };
      }
      case 'TRUE_FALSE':
        if (correctAnswer === null) return 'Doğru cevabı seçin.';
        return { ...base, type, content: { correctAnswer } };
      case 'FILL_BLANK': {
        if (blankCount === 0) return 'Metne en az bir boşluk (___) ekleyin.';
        const blanks = Array.from({ length: blankCount }, (_, i) => ({ accepted: splitComma(blankAnswers[i] ?? '') }));
        const missing = blanks.findIndex((b) => b.accepted.length === 0);
        if (missing >= 0) return `${missing + 1}. boşluk için en az bir kabul edilen cevap yazın.`;
        return { ...base, type, content: { blanks, caseSensitive } };
      }
      case 'MATCHING': {
        const filled = pairs.filter((p) => p.left.trim() || p.right.trim());
        if (filled.some((p) => !p.left.trim() || !p.right.trim())) return 'Her çiftin iki tarafını da doldurun.';
        if (filled.length < MIN_PAIRS) return 'En az iki eşleştirme çifti girin.';
        return {
          ...base,
          type,
          content: { pairs: filled.map((p) => ({ id: p.id, left: p.left.trim(), right: p.right.trim() })) },
        };
      }
      case 'SHORT_ANSWER': {
        const accepted = splitLines(shortAnswers);
        if (accepted.length === 0) return 'En az bir kabul edilen cevap yazın.';
        return { ...base, type, content: { accepted, caseSensitive } };
      }
      case 'ESSAY':
        return { ...base, type, content: { rubric: rubric.trim() || null } };
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = buildPayload();
    if (typeof payload === 'string') {
      setError(payload);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Soru kaydedilemedi.');
      setBusy(false);
    }
  };

  const draft = buildPayload();
  const typeMeta = QUESTION_TYPES[type];

  return (
    <Dialog title={question ? 'Soruyu Düzenle' : 'Yeni Soru'} size="lg" busy={busy} onClose={onClose}>
      <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
        {question && question.usageCount > 0 && (
          <div className={styles.notice} role="note">
            <Text role="body-sm" as="p">
              Bu soru {question.usageCount} sınavda kullanılıyor; değişiklikler o sınavlara da yansır.
            </Text>
          </div>
        )}

        <div className={formStyles.row3}>
          <label className={formStyles.field}>
            <Text role="label-md" as="span" tone="muted">
              Soru tipi
            </Text>
            <select
              className={formStyles.input}
              value={type}
              onChange={(event) => changeType(event.target.value as QuestionType)}
              aria-describedby={`${uid}-type-hint`}
            >
              {QUESTION_TYPE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {QUESTION_TYPES[key].label}
                </option>
              ))}
            </select>
          </label>
          <label className={formStyles.field}>
            <Text role="label-md" as="span" tone="muted">
              Zorluk
            </Text>
            <select
              className={formStyles.input}
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as QuestionDifficulty)}
            >
              {DIFFICULTY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {DIFFICULTIES[key].label}
                </option>
              ))}
            </select>
          </label>
          <label className={formStyles.field}>
            <Text role="label-md" as="span" tone="muted">
              Varsayılan puan
            </Text>
            <input
              className={formStyles.input}
              type="number"
              min={1}
              max={100}
              value={points}
              onChange={(event) => setPoints(event.target.value)}
            />
          </label>
        </div>
        <div id={`${uid}-type-hint`} className={styles.hint}>
          <Text role="body-sm" as="p" tone="muted">
            {typeMeta.hint}
          </Text>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.field}>
            <Text role="label-md" as="span" tone="muted">
              Soru metni
            </Text>
            <textarea
              ref={stemRef}
              className={formStyles.textarea}
              rows={4}
              maxLength={5000}
              value={stem}
              onChange={(event) => setStem(event.target.value)}
              required
              aria-required="true"
            />
          </label>
          {type === 'FILL_BLANK' && (
            <div className={styles.inlineRow}>
              <Button variant="ghost" size="sm" iconStart="add" onClick={insertBlank}>
                İmlecin olduğu yere boşluk ekle
              </Button>
              <span aria-live="polite">
                <Text role="body-sm" tone="muted" as="span">
                  Metinde {blankCount} boşluk var.
                </Text>
              </span>
            </div>
          )}
        </div>

        {(type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') && (
          <fieldset className={formStyles.fieldset}>
            <legend>
              <Text role="label-md" as="span" tone="muted">
                Seçenekler — doğru {type === 'SINGLE_CHOICE' ? 'cevabı' : 'cevapları'} işaretleyin
              </Text>
            </legend>
            {options.map((option, index) => (
              <div key={option.key} className={styles.optionRow}>
                <input
                  type={type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                  name={`${uid}-correct`}
                  checked={option.correct}
                  onChange={(event) => markCorrect(option.key, event.target.checked)}
                  aria-label={`${index + 1}. seçenek doğru cevap`}
                  className={styles.correctToggle}
                />
                <span className={styles.optionLetter} aria-hidden="true">
                  {String.fromCharCode(65 + index)}
                </span>
                <input
                  className={formStyles.input}
                  type="text"
                  value={option.text}
                  maxLength={1000}
                  placeholder={`${index + 1}. seçenek`}
                  aria-label={`${index + 1}. seçenek metni`}
                  onChange={(event) => updateOption(option.key, { text: event.target.value })}
                />
                <IconButton
                  icon="close"
                  label={`${index + 1}. seçeneği kaldır`}
                  disabled={options.length <= MIN_OPTIONS}
                  onClick={() => setOptions((prev) => prev.filter((o) => o.key !== option.key))}
                />
              </div>
            ))}
            <div>
              <Button
                variant="ghost"
                size="sm"
                iconStart="add"
                disabled={options.length >= MAX_OPTIONS}
                onClick={() => setOptions((prev) => [...prev, ...blankOptions(1)])}
              >
                Seçenek ekle
              </Button>
            </div>
          </fieldset>
        )}

        {type === 'TRUE_FALSE' && (
          <fieldset className={formStyles.fieldset}>
            <legend>
              <Text role="label-md" as="span" tone="muted">
                Doğru cevap
              </Text>
            </legend>
            <div className={styles.inlineRow}>
              {[true, false].map((value) => (
                <label key={String(value)} className={formStyles.checkbox}>
                  <input
                    type="radio"
                    name={`${uid}-tf`}
                    checked={correctAnswer === value}
                    onChange={() => setCorrectAnswer(value)}
                  />
                  <Text role="body-md" as="span">
                    {value ? 'Doğru' : 'Yanlış'}
                  </Text>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {type === 'FILL_BLANK' && (
          <fieldset className={formStyles.fieldset}>
            <legend>
              <Text role="label-md" as="span" tone="muted">
                Boşlukların kabul edilen cevapları (virgülle ayırın)
              </Text>
            </legend>
            {blankCount === 0 ? (
              <Text role="body-sm" tone="muted" as="p">
                Soru metnine en az bir ___ ekleyin; her boşluk için burada bir alan açılır.
              </Text>
            ) : (
              Array.from({ length: blankCount }, (_, index) => (
                <label key={index} className={styles.blankRow}>
                  <Text role="label-md" as="span">
                    {index + 1}. boşluk
                  </Text>
                  <input
                    className={formStyles.input}
                    type="text"
                    value={blankAnswers[index] ?? ''}
                    placeholder="ör. Ankara, ankara"
                    onChange={(event) =>
                      setBlankAnswers((prev) => {
                        const next = [...prev];
                        next[index] = event.target.value;
                        return next;
                      })
                    }
                  />
                </label>
              ))
            )}
            <label className={formStyles.checkbox}>
              <input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} />
              <Text role="body-md" as="span">
                Büyük/küçük harf duyarlı
              </Text>
            </label>
          </fieldset>
        )}

        {type === 'MATCHING' && (
          <fieldset className={formStyles.fieldset}>
            <legend>
              <Text role="label-md" as="span" tone="muted">
                Eşleştirme çiftleri (sol öğe → doğru eşi)
              </Text>
            </legend>
            {pairs.map((pair, index) => (
              <div key={pair.key} className={styles.pairRow}>
                <input
                  className={[formStyles.input, styles.pairLeft].join(' ')}
                  type="text"
                  value={pair.left}
                  maxLength={500}
                  placeholder="Sol öğe"
                  aria-label={`${index + 1}. çiftin sol öğesi`}
                  onChange={(event) => updatePair(pair.key, { left: event.target.value })}
                />
                <span aria-hidden="true" className={styles.arrow}>
                  →
                </span>
                <input
                  className={[formStyles.input, styles.pairRight].join(' ')}
                  type="text"
                  value={pair.right}
                  maxLength={500}
                  placeholder="Doğru eşi"
                  aria-label={`${index + 1}. çiftin sağ öğesi`}
                  onChange={(event) => updatePair(pair.key, { right: event.target.value })}
                />
                <IconButton
                  icon="close"
                  className={styles.pairRemove}
                  label={`${index + 1}. çifti kaldır`}
                  disabled={pairs.length <= MIN_PAIRS}
                  onClick={() => setPairs((prev) => prev.filter((p) => p.key !== pair.key))}
                />
              </div>
            ))}
            <div>
              <Button
                variant="ghost"
                size="sm"
                iconStart="add"
                disabled={pairs.length >= MAX_PAIRS}
                onClick={() => setPairs((prev) => [...prev, ...blankPairs(1)])}
              >
                Çift ekle
              </Button>
            </div>
          </fieldset>
        )}

        {type === 'SHORT_ANSWER' && (
          <fieldset className={formStyles.fieldset}>
            <legend>
              <Text role="label-md" as="span" tone="muted">
                Kabul edilen cevaplar
              </Text>
            </legend>
            <label className={formStyles.field}>
              <Text role="body-sm" as="span" tone="muted">
                Her satıra bir cevap yazın.
              </Text>
              <textarea
                className={formStyles.textarea}
                rows={3}
                value={shortAnswers}
                onChange={(event) => setShortAnswers(event.target.value)}
              />
            </label>
            <label className={formStyles.checkbox}>
              <input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} />
              <Text role="body-md" as="span">
                Büyük/küçük harf duyarlı
              </Text>
            </label>
          </fieldset>
        )}

        {type === 'ESSAY' && (
          <label className={formStyles.field}>
            <Text role="label-md" as="span" tone="muted">
              Değerlendirme rubriği (isteğe bağlı)
            </Text>
            <textarea
              className={formStyles.textarea}
              rows={4}
              maxLength={5000}
              value={rubric}
              placeholder={'ör. Kavramın doğru tanımı (3 puan)\nÖrnek verilmesi (2 puan)'}
              onChange={(event) => setRubric(event.target.value)}
            />
          </label>
        )}

        <div className={formStyles.row}>
          <label className={formStyles.field}>
            <Text role="label-md" as="span" tone="muted">
              Konu (isteğe bağlı)
            </Text>
            <input
              className={formStyles.input}
              type="text"
              value={topic}
              maxLength={100}
              list={`${uid}-topics`}
              onChange={(event) => setTopic(event.target.value)}
            />
            <datalist id={`${uid}-topics`}>
              {topicSuggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </label>
          <label className={formStyles.field}>
            <Text role="label-md" as="span" tone="muted">
              Açıklama (sonuçta doğru cevapla gösterilir)
            </Text>
            <textarea
              className={formStyles.textarea}
              rows={2}
              maxLength={5000}
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
            />
          </label>
        </div>

        <details className={styles.previewBox}>
          <summary>
            <Text role="label-lg" as="span">
              Önizleme
            </Text>
          </summary>
          {typeof draft === 'string' ? (
            <Text role="body-sm" tone="muted" as="p">
              Önizleme için: {draft}
            </Text>
          ) : (
            <QuestionPreview question={toPreview(draft)} />
          )}
        </details>

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
            {busy ? 'Kaydediliyor…' : question ? 'Kaydet' : 'Soruyu Ekle'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

import { useState } from 'react';
import { Badge, Button, Dialog, SearchInput, Text, formStyles } from '../../../../components';
import type { QuestionDifficulty, QuestionType } from '../../../../types';
import { useBankQuestions, useQuestionBanks } from '../../question-banks/data/questionBankApi';
import { DIFFICULTIES, DIFFICULTY_KEYS, QUESTION_TYPES, QUESTION_TYPE_KEYS, searchKey } from '../../question-banks/questionMeta';
import styles from './QuestionPickerDialog.module.css';

interface QuestionPickerDialogProps {
  /** Sınavın kursu: yalnızca bu kursun ve genel bankaların soruları eklenebilir. */
  courseId: string;
  /** Sınavda zaten olan sorular. */
  existingIds: ReadonlySet<string>;
  onAdd: (questionIds: string[]) => Promise<void>;
  onClose: () => void;
}

export function QuestionPickerDialog({ courseId, existingIds, onAdd, onClose }: QuestionPickerDialogProps) {
  const { banks, loading: banksLoading } = useQuestionBanks();
  const usable = banks.filter((bank) => !bank.course || bank.course.id === courseId);
  const [bankId, setBankId] = useState('');
  const selectedBankId = bankId || usable[0]?.id || null;
  const { questions, loading } = useBankQuestions(selectedBankId);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<QuestionType | ''>('');
  const [difficultyFilter, setDifficultyFilter] = useState<QuestionDifficulty | ''>('');
  // Seçim bankalar arasında korunur; birden çok bankadan soru seçilebilir.
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = questions.filter((q) => {
    if (typeFilter && q.type !== typeFilter) return false;
    if (difficultyFilter && q.difficulty !== difficultyFilter) return false;
    const term = searchKey(search.trim());
    return !term || searchKey(`${q.stem} ${q.topic ?? ''}`).includes(term);
  });
  const selectable = visible.filter((q) => !existingIds.has(q.id));
  const allVisibleSelected = selectable.length > 0 && selectable.every((q) => selected.includes(q.id));

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));

  const toggleAll = () =>
    setSelected((prev) =>
      allVisibleSelected
        ? prev.filter((id) => !selectable.some((q) => q.id === id))
        : [...prev, ...selectable.map((q) => q.id).filter((id) => !prev.includes(id))],
    );

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onAdd(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sorular eklenemedi.');
      setBusy(false);
    }
  };

  return (
    <Dialog title="Bankadan soru ekle" size="lg" busy={busy} onClose={onClose}>
      <div className={styles.filters}>
        <label className={formStyles.field}>
          <Text role="label-md" as="span" tone="muted">
            Soru bankası
          </Text>
          <select
            className={formStyles.input}
            value={selectedBankId ?? ''}
            onChange={(event) => setBankId(event.target.value)}
            disabled={usable.length === 0}
          >
            {usable.length === 0 && <option value="">{banksLoading ? 'Yükleniyor…' : 'Kullanılabilir banka yok'}</option>}
            {usable.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name} ({bank.course ? 'kurs' : 'genel'}, {bank.questionCount} soru)
              </option>
            ))}
          </select>
        </label>
        <label className={formStyles.field}>
          <Text role="label-md" as="span" tone="muted">
            Tip
          </Text>
          <select
            className={formStyles.input}
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as QuestionType | '')}
          >
            <option value="">Tümü</option>
            {QUESTION_TYPE_KEYS.map((key) => (
              <option key={key} value={key}>
                {QUESTION_TYPES[key].short}
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
            value={difficultyFilter}
            onChange={(event) => setDifficultyFilter(event.target.value as QuestionDifficulty | '')}
          >
            <option value="">Tümü</option>
            {DIFFICULTY_KEYS.map((key) => (
              <option key={key} value={key}>
                {DIFFICULTIES[key].label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <SearchInput
        label="Soru metni veya konu ara"
        placeholder="Soru metni veya konu ara"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className={styles.search}
      />

      <div className={styles.listHeader}>
        <Text role="body-sm" tone="muted" as="span">
          {loading ? 'Sorular yükleniyor…' : `${visible.length} soru listeleniyor`}
        </Text>
        <Button variant="ghost" size="sm" disabled={selectable.length === 0} onClick={toggleAll}>
          {allVisibleSelected ? 'Seçimi kaldır' : 'Listelenenlerin tümünü seç'}
        </Button>
      </div>

      <ul className={styles.list} aria-label="Bankadaki sorular">
        {!loading && visible.length === 0 && (
          <li className={styles.empty}>
            <Text role="body-md" tone="muted">
              {usable.length === 0
                ? 'Bu sınavda kullanılabilecek soru bankası yok. Önce Soru Bankası sayfasından banka ve soru ekleyin.'
                : 'Bu bankada süzgeçlere uyan soru yok.'}
            </Text>
          </li>
        )}
        {visible.map((question) => {
          const added = existingIds.has(question.id);
          return (
            <li key={question.id}>
              <label className={[styles.item, added ? styles.added : ''].join(' ')}>
                <input
                  type="checkbox"
                  checked={added || selected.includes(question.id)}
                  disabled={added}
                  onChange={(event) => toggle(question.id, event.target.checked)}
                />
                <span className={styles.itemBody}>
                  <Text role="body-md" as="span" tone="main" className={styles.stem}>
                    {question.stem}
                  </Text>
                  <span className={styles.badges}>
                    <Badge tone="secondary" icon={QUESTION_TYPES[question.type].icon}>
                      {QUESTION_TYPES[question.type].short}
                    </Badge>
                    <Badge tone={DIFFICULTIES[question.difficulty].tone} variant="soft">
                      {DIFFICULTIES[question.difficulty].label}
                    </Badge>
                    {question.topic && <Badge tone="neutral">{question.topic}</Badge>}
                    <Badge tone="muted">{question.points} puan</Badge>
                    {added && (
                      <Badge tone="success" icon="check">
                        Sınavda
                      </Badge>
                    )}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {error && (
        <div className={formStyles.error} role="alert">
          <Text role="body-sm" tone="error" as="p">
            {error}
          </Text>
        </div>
      )}

      <div className={[formStyles.actions, styles.footer].join(' ')}>
        <span className={formStyles.spacer} aria-live="polite">
          <Text role="label-md" as="span">
            {selected.length} soru seçildi
          </Text>
        </span>
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          İptal
        </Button>
        <Button variant="primary" disabled={busy || selected.length === 0} onClick={() => void submit()}>
          {busy ? 'Ekleniyor…' : 'Seçilenleri ekle'}
        </Button>
      </div>
    </Dialog>
  );
}

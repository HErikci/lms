import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, ConfirmDialog, Icon, SearchInput, Text } from '../../../components';
import { PageContainer } from '../../../layout/PageContainer';
import type { BankQuestion, QuestionDifficulty, QuestionType } from '../../../types';
import { BankFormDialog } from './components/BankFormDialog';
import { QuestionFormDialog } from './components/QuestionFormDialog';
import { QuestionPreview } from './components/QuestionPreview';
import {
  createQuestion,
  deleteBank,
  deleteQuestion,
  updateBank,
  updateQuestion,
  useBank,
  useBankQuestions,
} from './data/questionBankApi';
import type { BankInput, QuestionPayload } from './data/questionBankApi';
import { DIFFICULTIES, DIFFICULTY_KEYS, QUESTION_TYPES, QUESTION_TYPE_KEYS, searchKey } from './questionMeta';
import styles from './QuestionBankDetailPage.module.css';

export function QuestionBankDetailPage() {
  const { bankId } = useParams<{ bankId: string }>();
  const navigate = useNavigate();
  const { bank, setBank, loading: bankLoading, error: bankError } = useBank(bankId);
  const { questions, loading, error, reload } = useBankQuestions(bankId);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<QuestionType | ''>('');
  const [difficultyFilter, setDifficultyFilter] = useState<QuestionDifficulty | ''>('');
  const [topicFilter, setTopicFilter] = useState('');
  // undefined = kapalı, null = yeni soru, nesne = düzenleme.
  const [editing, setEditing] = useState<BankQuestion | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<BankQuestion | null>(null);
  const [editingBank, setEditingBank] = useState(false);
  const [deletingBank, setDeletingBank] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const topics = useMemo(
    () =>
      [...new Set(questions.map((q) => q.topic).filter((t): t is string => Boolean(t)))].sort((a, b) =>
        a.localeCompare(b, 'tr'),
      ),
    [questions],
  );

  const counts = useMemo(() => {
    const byDifficulty: Record<QuestionDifficulty, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
    for (const q of questions) byDifficulty[q.difficulty] += 1;
    return byDifficulty;
  }, [questions]);

  const visible = questions.filter((q) => {
    if (typeFilter && q.type !== typeFilter) return false;
    if (difficultyFilter && q.difficulty !== difficultyFilter) return false;
    if (topicFilter && q.topic !== topicFilter) return false;
    const term = searchKey(search.trim());
    return !term || searchKey(`${q.stem} ${q.topic ?? ''}`).includes(term);
  });

  const handleSaveQuestion = async (payload: QuestionPayload) => {
    if (!bankId) return;
    if (editing) {
      await updateQuestion(editing.id, payload);
      setNotice('Soru güncellendi.');
    } else {
      await createQuestion(bankId, payload);
      setNotice('Soru bankaya eklendi.');
    }
    setEditing(undefined);
    reload();
  };

  const handleSaveBank = async (input: BankInput) => {
    if (!bank) return;
    setBank(await updateBank(bank.id, { name: input.name, description: input.description }));
    setEditingBank(false);
  };

  if (bankLoading && !bank) {
    return (
      <PageContainer>
        <Text role="body-md" tone="muted" as="p">
          Yükleniyor…
        </Text>
      </PageContainer>
    );
  }
  if (!bank) {
    return (
      <PageContainer>
        <Link to="/yonetim/soru-bankasi" className={styles.back}>
          <Icon name="arrow_back" size="sm" />
          Soru bankaları
        </Link>
        <Card padding="lg" elevation="1">
          <Text role="body-md" tone="error" as="p">
            {bankError ?? 'Soru bankası bulunamadı.'}
          </Text>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className={styles.top}>
        <Link to="/yonetim/soru-bankasi" className={styles.back}>
          <Icon name="arrow_back" size="sm" />
          Soru bankaları
        </Link>

        <div className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.badges}>
              <Badge tone={bank.course ? 'cyan' : 'navy'} icon={bank.course ? 'menu_book' : 'public'}>
                {bank.course?.title ?? 'Genel banka'}
              </Badge>
              {!bank.canEdit && (
                <Badge tone="neutral" icon="lock">
                  Salt okunur
                </Badge>
              )}
            </span>
            <Text role="headline-lg" as="h1">
              {bank.name}
            </Text>
            {bank.description && (
              <Text role="body-md" tone="muted" as="p">
                {bank.description}
              </Text>
            )}
            <Text role="label-md" tone="muted" as="p">
              {questions.length} soru · {DIFFICULTY_KEYS.map((key) => `${DIFFICULTIES[key].label} ${counts[key]}`).join(' · ')}
            </Text>
          </div>
          {bank.canEdit && (
            <div className={styles.headerActions}>
              <Button variant="ghost" iconStart="edit" onClick={() => setEditingBank(true)}>
                Bankayı düzenle
              </Button>
              <Button variant="ghost" iconStart="delete" onClick={() => setDeletingBank(true)}>
                Sil
              </Button>
              <Button variant="primary" iconStart="add" onClick={() => setEditing(null)}>
                Yeni Soru
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.toolbar}>
          <SearchInput
            label="Soru metni veya konu ara"
            placeholder="Soru metni veya konu ara"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={styles.search}
          />
          <label className={styles.filter}>
            <Text role="label-md" as="span" tone="muted">
              Tip
            </Text>
            <select
              className={styles.select}
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as QuestionType | '')}
            >
              <option value="">Tümü</option>
              {QUESTION_TYPE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {QUESTION_TYPES[key].label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filter}>
            <Text role="label-md" as="span" tone="muted">
              Zorluk
            </Text>
            <select
              className={styles.select}
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
          <label className={styles.filter}>
            <Text role="label-md" as="span" tone="muted">
              Konu
            </Text>
            <select className={styles.select} value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}>
              <option value="">Tümü</option>
              {topics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div aria-live="polite" className={styles.messages}>
          {notice && (
            <Text role="body-md" tone="success" as="p">
              {notice}
            </Text>
          )}
          {error && (
            <Text role="body-md" tone="error" as="p">
              {error}
            </Text>
          )}
        </div>
      </div>

      {!loading && !error && visible.length === 0 && (
        <Card padding="lg" elevation="1">
          <Text role="body-md" tone="muted" as="p">
            {questions.length === 0
              ? bank.canEdit
                ? 'Bankada henüz soru yok. "Yeni Soru" ile ilk soruyu ekleyin.'
                : 'Bankada henüz soru yok.'
              : 'Süzgeçlere uyan soru yok.'}
          </Text>
        </Card>
      )}

      <ol className={styles.list}>
        {visible.map((question) => {
          const typeMeta = QUESTION_TYPES[question.type];
          const difficulty = DIFFICULTIES[question.difficulty];
          return (
            <li key={question.id}>
              <Card padding="lg" elevation="1" className={styles.questionCard}>
                <div className={styles.questionMeta}>
                  <span className={styles.badges}>
                    <Badge tone="secondary" icon={typeMeta.icon}>
                      {typeMeta.short}
                    </Badge>
                    <Badge tone={difficulty.tone} variant="soft">
                      {difficulty.label}
                    </Badge>
                    {question.topic && <Badge tone="neutral">{question.topic}</Badge>}
                    <Badge tone="muted">{question.points} puan</Badge>
                    {question.usageCount > 0 && (
                      <Badge tone="info" icon="fact_check">
                        {question.usageCount} sınavda
                      </Badge>
                    )}
                  </span>
                  {bank.canEdit && (
                    <span className={styles.questionActions}>
                      <Button variant="ghost" size="sm" iconStart="edit" onClick={() => setEditing(question)}>
                        Düzenle
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconStart="delete"
                        disabled={question.usageCount > 0}
                        title={question.usageCount > 0 ? 'Sınavlarda kullanılan soru silinemez' : undefined}
                        onClick={() => setDeleting(question)}
                      >
                        Sil
                      </Button>
                    </span>
                  )}
                </div>
                <QuestionPreview question={question} />
              </Card>
            </li>
          );
        })}
      </ol>

      {editing !== undefined && (
        <QuestionFormDialog
          question={editing}
          topicSuggestions={topics}
          onSave={handleSaveQuestion}
          onClose={() => setEditing(undefined)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Soruyu sil"
          confirmLabel="Soruyu sil"
          destructive
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteQuestion(deleting.id);
            setDeleting(null);
            setNotice('Soru silindi.');
            reload();
          }}
        >
          <Text role="body-md" as="p">
            Bu soru bankadan kalıcı olarak silinecek.
          </Text>
        </ConfirmDialog>
      )}

      {editingBank && (
        <BankFormDialog
          bank={bank}
          courses={[]}
          canCreateGeneral={false}
          onSave={handleSaveBank}
          onClose={() => setEditingBank(false)}
        />
      )}

      {deletingBank && (
        <ConfirmDialog
          title="Bankayı sil"
          confirmLabel="Bankayı sil"
          destructive
          onClose={() => setDeletingBank(false)}
          onConfirm={async () => {
            await deleteBank(bank.id);
            navigate('/yonetim/soru-bankasi');
          }}
        >
          <Text role="body-md" as="p">
            “{bank.name}” bankası ve içindeki {questions.length} soru kalıcı olarak silinecek. Sınavlarda kullanılan
            soru varsa silme engellenir.
          </Text>
        </ConfirmDialog>
      )}
    </PageContainer>
  );
}

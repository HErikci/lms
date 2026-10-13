import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, ConfirmDialog, Icon, SearchInput, Text } from '../../../components';
import { PageContainer } from '../../../layout/PageContainer';
import { useCurrentUser } from '../../../data/useCurrentUser';
import type { QuestionBank } from '../../../types';
import { useEventCourses } from '../../calendar/useEventCourses';
import { BankFormDialog } from './components/BankFormDialog';
import { createBank, deleteBank, updateBank, useQuestionBanks } from './data/questionBankApi';
import type { BankInput } from './data/questionBankApi';
import { searchKey } from './questionMeta';
import styles from './QuestionBanksPage.module.css';

/** Kurs süzgeci: '' = tümü, 'GENERAL' = genel bankalar, diğerleri kurs kimliği. */
type CourseFilter = string;

export function QuestionBanksPage() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const courses = useEventCourses(user);
  const { banks, loading, error, reload } = useQuestionBanks();
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState<CourseFilter>('');
  // undefined = kapalı, null = yeni banka, nesne = düzenleme.
  const [editing, setEditing] = useState<QuestionBank | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<QuestionBank | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  // Süzgeçte, kullanıcının görebildiği bankaların kursları listelenir.
  const courseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const bank of banks) if (bank.course) map.set(bank.course.id, bank.course.title);
    return [...map].sort((a, b) => a[1].localeCompare(b[1], 'tr'));
  }, [banks]);

  const visible = banks.filter((bank) => {
    if (courseFilter === 'GENERAL' && bank.course) return false;
    if (courseFilter && courseFilter !== 'GENERAL' && bank.course?.id !== courseFilter) return false;
    const term = searchKey(search.trim());
    return !term || searchKey(`${bank.name} ${bank.description ?? ''}`).includes(term);
  });

  const handleSave = async (input: BankInput) => {
    if (editing) {
      await updateBank(editing.id, { name: input.name, description: input.description });
      setEditing(undefined);
      reload();
    } else {
      const created = await createBank(input);
      navigate(`/yonetim/soru-bankasi/${created.id}`);
    }
  };

  return (
    <PageContainer>
      <div className={styles.header}>
        <div>
          <Text role="headline-lg" as="h1">
            Soru Bankası
          </Text>
          <Text role="body-md" tone="muted" as="p">
            Soruları konu ve zorluğa göre bankalarda toplayın; sınav hazırlarken bankalardan seçin.
          </Text>
        </div>
        <Button
          variant="primary"
          iconStart="add"
          disabled={!isAdmin && courses.length === 0}
          onClick={() => setEditing(null)}
        >
          Yeni Banka
        </Button>
      </div>

      <div className={styles.toolbar}>
        <SearchInput
          label="Banka ara"
          placeholder="Banka ara"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={styles.search}
        />
        <label className={styles.filter}>
          <Text role="label-md" as="span" tone="muted">
            Kurs
          </Text>
          <select className={styles.select} value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
            <option value="">Tümü</option>
            <option value="GENERAL">Genel bankalar</option>
            {courseOptions.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <Text role="body-md" tone="error" as="p">
          {error}
        </Text>
      )}
      {loading && banks.length === 0 && (
        <Text role="body-md" tone="muted" as="p">
          Yükleniyor…
        </Text>
      )}
      {!loading && !error && visible.length === 0 && (
        <Card padding="lg" elevation="1">
          <Text role="body-md" tone="muted" as="p">
            {banks.length === 0 ? 'Henüz soru bankası yok. "Yeni Banka" ile ilkini oluşturun.' : 'Süzgeçlere uyan banka yok.'}
          </Text>
        </Card>
      )}

      <ul className={styles.grid}>
        {visible.map((bank) => (
          <li key={bank.id}>
            <Card padding="lg" elevation="1" className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.icon}>
                  <Icon name="library_books" size="md" filled />
                </span>
                <span className={styles.badges}>
                  <Badge tone={bank.course ? 'cyan' : 'navy'} icon={bank.course ? 'menu_book' : 'public'}>
                    {bank.course?.title ?? 'Genel'}
                  </Badge>
                  {!bank.canEdit && (
                    <Badge tone="neutral" icon="lock">
                      Salt okunur
                    </Badge>
                  )}
                </span>
              </div>
              <Text role="title-md" as="h2" tone="main" className={styles.title}>
                <Link to={`/yonetim/soru-bankasi/${bank.id}`}>{bank.name}</Link>
              </Text>
              {bank.description && (
                <Text role="body-sm" tone="muted" as="p" className={styles.description}>
                  {bank.description}
                </Text>
              )}
              <Text role="label-md" tone="muted" as="p" className={styles.meta}>
                {bank.questionCount} soru{bank.createdBy ? ` · ${bank.createdBy.name}` : ''}
              </Text>
              {bank.canEdit && (
                <div className={styles.actions}>
                  <Button variant="ghost" size="sm" iconStart="edit" onClick={() => setEditing(bank)}>
                    Düzenle<span className={styles.srOnly}>: {bank.name}</span>
                  </Button>
                  <Button variant="ghost" size="sm" iconStart="delete" onClick={() => setDeleting(bank)}>
                    Sil<span className={styles.srOnly}>: {bank.name}</span>
                  </Button>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>

      {editing !== undefined && (
        <BankFormDialog
          bank={editing}
          courses={courses}
          canCreateGeneral={isAdmin}
          onSave={handleSave}
          onClose={() => setEditing(undefined)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Bankayı sil"
          confirmLabel="Bankayı sil"
          destructive
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteBank(deleting.id);
            setDeleting(null);
            reload();
          }}
        >
          <Text role="body-md" as="p">
            “{deleting.name}” bankası ve içindeki {deleting.questionCount} soru kalıcı olarak silinecek. Sınavlarda
            kullanılan soru varsa silme engellenir.
          </Text>
        </ConfirmDialog>
      )}
    </PageContainer>
  );
}

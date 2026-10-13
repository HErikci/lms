import { useEffect, useState } from 'react';
import { Avatar, Badge, Button, Card, Dialog, SearchInput, StatTile, Text } from '../../../components';
import { PageContainer } from '../../../layout/PageContainer';
import { useCurrentUser } from '../../../data/useCurrentUser';
import type { AdminUser, UserRole } from '../../../types';
import { UserFormDialog } from './components/UserFormDialog';
import { PAGE_SIZE, createUser, updateUser, useAdminUsers } from './data/useAdminUsers';
import type { CreateUserInput, UpdateUserInput, UserFilters } from './data/useAdminUsers';
import { ROLE_META, ROLE_OPTIONS } from './roles';
import styles from './AdminUsersPage.module.css';

const dateFormat = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' });

/** undefined = kapalı, null = yeni kullanıcı, nesne = düzenleme. */
type FormState = AdminUser | null | undefined;

export function AdminUsersPage() {
  const { user: me } = useCurrentUser();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<UserFilters>({ q: '', role: '', status: '', page: 1 });
  const { users, total, summary, loading, error, reload } = useAdminUsers(filters);
  const [form, setForm] = useState<FormState>(undefined);
  const [toggling, setToggling] = useState<AdminUser | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Arama kutusu yazmayı bitirince (300 ms) süzgece uygulanır ve ilk sayfaya dönülür.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((prev) => (prev.q === search ? prev : { ...prev, q: search, page: 1 }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const setFilter = <K extends 'role' | 'status'>(key: K, value: UserFilters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));

  const handleCreate = async (input: CreateUserInput) => {
    const created = await createUser(input);
    setForm(undefined);
    setNotice(`${created.name} oluşturuldu.`);
    await reload();
  };

  const handleUpdate = async (input: UpdateUserInput) => {
    if (!form) return;
    const updated = await updateUser(form.id, input);
    setForm(undefined);
    setNotice(`${updated.name} güncellendi.`);
    await reload();
  };

  const confirmToggle = async () => {
    if (!toggling) return;
    setToggleBusy(true);
    setToggleError(null);
    try {
      const disable = toggling.status === 'ACTIVE';
      const updated = await updateUser(toggling.id, { disabled: disable });
      setToggling(null);
      setNotice(disable ? `${updated.name} devre dışı bırakıldı.` : `${updated.name} yeniden etkinleştirildi.`);
      await reload();
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : 'İşlem tamamlanamadı.');
    } finally {
      setToggleBusy(false);
    }
  };

  const openToggle = (user: AdminUser) => {
    setToggleError(null);
    setToggling(user);
  };

  return (
    <PageContainer>
      <div className={styles.header}>
        <div>
          <Text role="headline-lg" as="h1">
            Kullanıcı Yönetimi
          </Text>
          <Text role="body-md" tone="muted" as="p">
            Hesap oluşturun, rolleri düzenleyin, şifre sıfırlayın ve erişimi kapatın.
          </Text>
        </div>
        <Button variant="primary" iconStart="person_add" onClick={() => setForm(null)}>
          Yeni Kullanıcı
        </Button>
      </div>

      {summary && (
        <div className={styles.stats}>
          <StatTile
            label="Toplam Kullanıcı"
            value={String(summary.total)}
            icon="group"
            footer={
              <Text role="body-sm" tone="muted">
                {summary.disabled} devre dışı
              </Text>
            }
          />
          <StatTile label="Öğrenci" value={String(summary.students)} icon="school" iconTone="success" />
          <StatTile label="Eğitmen" value={String(summary.instructors)} icon="co_present" iconTone="cyan" />
          <StatTile label="Yönetici" value={String(summary.admins)} icon="shield_person" iconTone="warning" />
        </div>
      )}

      <div className={styles.toolbar}>
        <SearchInput
          label="Ad veya e-posta ile ara"
          placeholder="Ad veya e-posta ile ara"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={styles.search}
        />
        <label className={styles.filter}>
          <Text role="label-md" as="span" tone="muted">
            Rol
          </Text>
          <select
            className={styles.select}
            value={filters.role}
            onChange={(event) => setFilter('role', event.target.value as UserRole | '')}
          >
            <option value="">Tümü</option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filter}>
          <Text role="label-md" as="span" tone="muted">
            Durum
          </Text>
          <select
            className={styles.select}
            value={filters.status}
            onChange={(event) => setFilter('status', event.target.value as UserFilters['status'])}
          >
            <option value="">Tümü</option>
            <option value="ACTIVE">Etkin</option>
            <option value="DISABLED">Devre dışı</option>
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

      <Card padding="none" elevation="1" className={styles.tableCard}>
        <table className={styles.table} aria-busy={loading}>
          <caption className={styles.srOnly}>
            Kullanıcılar, sayfa {filters.page} / {pageCount}
          </caption>
          <thead className="label-md">
            <tr>
              <th scope="col">Kullanıcı</th>
              <th scope="col">Roller</th>
              <th scope="col">Durum</th>
              <th scope="col">Kurslar</th>
              <th scope="col">Katılım</th>
              <th scope="col">
                <span className={styles.srOnly}>İşlemler</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  <Text role="body-md" tone="muted">
                    Süzgeçlere uyan kullanıcı bulunamadı.
                  </Text>
                </td>
              </tr>
            )}
            {users.map((user) => {
              const isSelf = user.id === me?.id;
              const disabled = user.status === 'DISABLED';
              return (
                <tr key={user.id} className={disabled ? styles.disabledRow : undefined}>
                  <td data-label="Kullanıcı">
                    <span className={styles.identity}>
                      <Avatar name={user.name} src={user.avatarUrl ?? undefined} />
                      <span className={styles.identityText}>
                        <Text role="label-lg" tone="main">
                          {user.name}
                          {isSelf && <span className={styles.you}> (siz)</span>}
                        </Text>
                        <Text role="body-sm" tone="muted" className={styles.email}>
                          {user.email}
                        </Text>
                      </span>
                    </span>
                  </td>
                  <td data-label="Roller">
                    <span className={styles.badges}>
                      {user.roles.map((role) => (
                        <Badge key={role} tone={ROLE_META[role].tone} variant="soft">
                          {ROLE_META[role].label}
                        </Badge>
                      ))}
                    </span>
                  </td>
                  <td data-label="Durum">
                    <Badge tone={disabled ? 'error' : 'success'} icon={disabled ? 'block' : 'check_circle'}>
                      {disabled ? 'Devre dışı' : 'Etkin'}
                    </Badge>
                  </td>
                  <td data-label="Kurslar">
                    <Text role="body-sm" tone="muted">
                      {user.enrollmentCount} kayıt
                      {user.teachingCount > 0 && ` · ${user.teachingCount} eğitmenlik`}
                    </Text>
                  </td>
                  <td data-label="Katılım">
                    <Text role="body-sm" tone="muted">
                      {dateFormat.format(new Date(user.createdAt))}
                    </Text>
                  </td>
                  <td className={styles.actionsCell}>
                    <span className={styles.actions}>
                      <Button variant="ghost" size="sm" iconStart="edit" onClick={() => setForm(user)}>
                        Düzenle
                        <span className={styles.srOnly}>: {user.name}</span>
                      </Button>
                      {!isSelf && (
                        <Button
                          variant={disabled ? 'secondary' : 'ghost'}
                          size="sm"
                          iconStart={disabled ? 'lock_open' : 'block'}
                          onClick={() => openToggle(user)}
                        >
                          {disabled ? 'Etkinleştir' : 'Devre dışı bırak'}
                          <span className={styles.srOnly}>: {user.name}</span>
                        </Button>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <nav className={styles.pagination} aria-label="Sayfalama">
        <Text role="body-sm" tone="muted">
          {total === 0
            ? 'Sonuç yok'
            : `${(filters.page - 1) * PAGE_SIZE + 1}–${Math.min(filters.page * PAGE_SIZE, total)} / ${total} kullanıcı`}
        </Text>
        <span className={styles.pageButtons}>
          <Button
            variant="ghost"
            size="sm"
            iconStart="chevron_left"
            disabled={filters.page <= 1 || loading}
            onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
          >
            Önceki
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconEnd="chevron_right"
            disabled={filters.page >= pageCount || loading}
            onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
          >
            Sonraki
          </Button>
        </span>
      </nav>

      {form !== undefined && (
        <UserFormDialog
          user={form}
          isSelf={form?.id === me?.id}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onClose={() => setForm(undefined)}
        />
      )}

      {toggling && (
        <Dialog
          title={toggling.status === 'ACTIVE' ? 'Kullanıcıyı devre dışı bırak' : 'Kullanıcıyı etkinleştir'}
          size="sm"
          busy={toggleBusy}
          onClose={() => setToggling(null)}
        >
          <Text role="body-md" as="p" className={styles.confirmText}>
            {toggling.status === 'ACTIVE'
              ? `${toggling.name} artık giriş yapamayacak ve açık oturumları hemen kapanacak. Kayıt ve not geçmişi korunur.`
              : `${toggling.name} yeniden giriş yapabilecek.`}
          </Text>
          {toggleError && (
            <Text role="body-sm" tone="error" as="p" className={styles.confirmText}>
              {toggleError}
            </Text>
          )}
          <div className={styles.confirmActions}>
            <Button variant="ghost" disabled={toggleBusy} onClick={() => setToggling(null)}>
              Vazgeç
            </Button>
            <Button
              variant={toggling.status === 'ACTIVE' ? 'destructive' : 'primary'}
              disabled={toggleBusy}
              onClick={() => void confirmToggle()}
            >
              {toggling.status === 'ACTIVE' ? 'Devre dışı bırak' : 'Etkinleştir'}
            </Button>
          </div>
        </Dialog>
      )}
    </PageContainer>
  );
}

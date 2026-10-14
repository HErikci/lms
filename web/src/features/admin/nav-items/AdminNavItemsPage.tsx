import { useState } from 'react';
import { Badge, Button, Card, IconButton, Icon, Text } from '../../../components';
import { PageContainer } from '../../../layout/PageContainer';
import { useAdminNavItems } from './data/useAdminNavItems';
import type { AdminNavItem, NavItemInput } from './data/useAdminNavItems';
import { NavItemForm } from './components/NavItemForm';
import styles from './AdminNavItemsPage.module.css';

const ROLE_LABELS: Record<string, string> = {
  GUARDIAN: 'Veli',
  STUDENT: 'Öğrenci',
  INSTRUCTOR: 'Okutman',
  ADMIN: 'Yönetici',
};

export function AdminNavItemsPage() {
  const { items, loading, error, createItem, updateItem, deleteItem } = useAdminNavItems();
  const [mode, setMode] = useState<'none' | 'create' | string>('none');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleCreate = async (input: NavItemInput) => {
    setSaving(true);
    setActionError(null);
    try {
      await createItem(input);
      setMode('none');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Menü öğesi oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, input: NavItemInput) => {
    setSaving(true);
    setActionError(null);
    try {
      await updateItem(id, input);
      setMode('none');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Menü öğesi güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: AdminNavItem) => {
    const confirmed = window.confirm(
      `"${item.label}" menü öğesini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
    );
    if (!confirmed) return;

    setActionError(null);
    try {
      await deleteItem(item.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Menü öğesi silinemedi.');
    }
  };

  return (
    <PageContainer>
      <div className={styles.header}>
        <div>
          <Text role="headline-lg" as="h1">
            Menü Yönetimi
          </Text>
          <Text role="body-md" tone="muted" as="p">
            {items.length} menü öğesi
          </Text>
        </div>
        <Button
          variant="primary"
          iconStart="add"
          onClick={() => setMode(mode === 'create' ? 'none' : 'create')}
        >
          Yeni Menü Öğesi
        </Button>
      </div>

      {actionError && (
        <Text role="body-md" tone="error" as="p">
          {actionError}
        </Text>
      )}

      {mode === 'create' && (
        <Card padding="lg" elevation="1" className={styles.formCard}>
          <Text role="title-md" as="h2" tone="main">
            Yeni Menü Öğesi Oluştur
          </Text>
          <NavItemForm saving={saving} onCancel={() => setMode('none')} onSubmit={handleCreate} />
        </Card>
      )}

      {loading && <Text role="body-md">Yükleniyor…</Text>}
      {!loading && error && (
        <Text role="body-md" tone="error">
          {error}
        </Text>
      )}
      {!loading && !error && items.length === 0 && (
        <Text role="body-md">Henüz menü öğesi bulunmuyor.</Text>
      )}

      {!loading && !error && items.length > 0 && (
        <div className={styles.list}>
          {items.map((item) => (
            <Card key={item.id} padding="lg" elevation="1">
              <div className={styles.row}>
                <div className={styles.info}>
                  <div className={styles.titleLine}>
                    <Icon name={item.icon} size="md" />
                    <Text role="title-md" as="h2" tone="main">
                      {item.label}
                    </Text>
                    <Text role="body-sm" tone="muted">
                      {item.path}
                    </Text>
                  </div>
                  <div className={styles.roleBadges}>
                    {item.roles.map((role) => (
                      <Badge key={role} tone="neutral" variant="soft">
                        {ROLE_LABELS[role] ?? role}
                      </Badge>
                    ))}
                    <Badge tone="info" variant="soft">
                      Sıra: {item.order}
                    </Badge>
                  </div>
                </div>
                <div className={styles.actions}>
                  <IconButton
                    icon="edit"
                    label="Menü Öğesini Düzenle"
                    onClick={() => setMode(mode === item.id ? 'none' : item.id)}
                  />
                  <IconButton
                    icon="delete"
                    label="Menü Öğesini Sil"
                    onClick={() => handleDelete(item)}
                  />
                </div>
              </div>

              {mode === item.id && (
                <div className={styles.editPanel}>
                  <NavItemForm
                    item={item}
                    saving={saving}
                    onCancel={() => setMode('none')}
                    onSubmit={(input) => handleUpdate(item.id, input)}
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

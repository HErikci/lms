import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Text } from '../../../../components';
import type { UserRole } from '../../../../types';
import type { AdminNavItem, NavItemInput } from '../data/useAdminNavItems';
import styles from './NavItemForm.module.css';

interface NavItemFormProps {
  item?: AdminNavItem;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (input: NavItemInput) => Promise<void>;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'STUDENT', label: 'Öğrenci' },
  { value: 'INSTRUCTOR', label: 'Okutman' },
  { value: 'ADMIN', label: 'Yönetici' },
];

export function NavItemForm({ item, saving, onCancel, onSubmit }: NavItemFormProps) {
  const [path, setPath] = useState(item?.path ?? '');
  const [label, setLabel] = useState(item?.label ?? '');
  const [icon, setIcon] = useState(item?.icon ?? '');
  const [order, setOrder] = useState(item?.order ?? 0);
  const [roles, setRoles] = useState<UserRole[]>(item?.roles ?? ['STUDENT']);

  const toggleRole = (role: UserRole) => {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((value) => value !== role) : [...prev, role],
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({
      path: path.trim(),
      label: label.trim(),
      icon: icon.trim(),
      order: Number(order),
      roles,
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.row}>
        <label className={styles.field}>
          <Text role="label-md" as="span" tone="muted">
            Etiket
          </Text>
          <input
            className={styles.input}
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
            minLength={2}
          />
        </label>

        <label className={styles.field}>
          <Text role="label-md" as="span" tone="muted">
            Yol
          </Text>
          <input
            className={styles.input}
            type="text"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="/orn-sayfa"
            required
          />
        </label>

        <label className={styles.field}>
          <Text role="label-md" as="span" tone="muted">
            İkon
          </Text>
          <input
            className={styles.input}
            type="text"
            value={icon}
            onChange={(event) => setIcon(event.target.value)}
            placeholder="grid_view"
            required
          />
        </label>

        <label className={styles.field}>
          <Text role="label-md" as="span" tone="muted">
            Sıra
          </Text>
          <input
            className={styles.input}
            type="number"
            value={order}
            onChange={(event) => setOrder(Number(event.target.value))}
            required
          />
        </label>
      </div>

      <div className={styles.field}>
        <Text role="label-md" as="span" tone="muted">
          Roller
        </Text>
        <div className={styles.roles}>
          {ROLE_OPTIONS.map((option) => (
            <label key={option.value} className={styles.roleOption}>
              <input
                className={styles.checkbox}
                type="checkbox"
                checked={roles.includes(option.value)}
                onChange={() => toggleRole(option.value)}
              />
              <Text role="body-sm" as="span">
                {option.label}
              </Text>
            </label>
          ))}
        </div>
      </div>

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Vazgeç
        </Button>
        <Button type="submit" variant="primary" disabled={saving || roles.length === 0}>
          {saving ? 'Kaydediliyor…' : item ? 'Güncelle' : 'Oluştur'}
        </Button>
      </div>
    </form>
  );
}

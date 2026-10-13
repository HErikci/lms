import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Text } from '../../../../components';
import type { ContentModule, ModuleInput } from '../data/useCourseContent';
import styles from './ModuleForm.module.css';

interface ModuleFormProps {
  module?: ContentModule;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (input: ModuleInput) => Promise<void>;
}

export function ModuleForm({ module, saving, onCancel, onSubmit }: ModuleFormProps) {
  const [title, setTitle] = useState(module?.title ?? '');
  const [order, setOrder] = useState(module?.order ?? 1);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({ title: title.trim(), order });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <Text role="label-md" as="span" tone="muted">
          Modül Başlığı
        </Text>
        <input
          className={styles.input}
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={2}
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
          min={1}
        />
      </label>

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Vazgeç
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Kaydediliyor…' : module ? 'Güncelle' : 'Oluştur'}
        </Button>
      </div>
    </form>
  );
}

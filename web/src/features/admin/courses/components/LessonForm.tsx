import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Text } from '../../../../components';
import type { ContentType } from '../../../../types';
import { CONTENT_TYPE_LABELS, CONTENT_TYPE_OPTIONS } from '../../../courses/contentType';
import type { ContentLesson, LessonInput, LessonStatus } from '../data/useCourseContent';
import styles from './LessonForm.module.css';

interface LessonFormProps {
  lesson?: ContentLesson;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (input: LessonInput) => Promise<void>;
}

export function LessonForm({ lesson, saving, onCancel, onSubmit }: LessonFormProps) {
  const [title, setTitle] = useState(lesson?.title ?? '');
  const [description, setDescription] = useState(lesson?.description ?? '');
  const [contentType, setContentType] = useState<ContentType>(lesson?.contentType ?? 'TEXT');
  const [contentUrl, setContentUrl] = useState(lesson?.contentUrl ?? '');
  const [order, setOrder] = useState(lesson?.order ?? 1);
  const [status, setStatus] = useState<LessonStatus>(lesson?.status ?? 'DRAFT');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      contentType,
      contentUrl: contentUrl.trim(),
      order,
      status,
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <Text role="label-md" as="span" tone="muted">
          Başlık
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
          Kısa Açıklama
        </Text>
        <textarea
          className={styles.textarea}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
        />
      </label>

      <div className={styles.row}>
        <label className={styles.field}>
          <Text role="label-md" as="span" tone="muted">
            İçerik Türü
          </Text>
          <select
            className={styles.input}
            value={contentType}
            onChange={(event) => setContentType(event.target.value as ContentType)}
          >
            {CONTENT_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {CONTENT_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <Text role="label-md" as="span" tone="muted">
            İçerik URL'i
          </Text>
          <input
            className={styles.input}
            type="text"
            value={contentUrl}
            onChange={(event) => setContentUrl(event.target.value)}
            placeholder="https://…"
          />
        </label>
      </div>

      <div className={styles.row}>
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

        <label className={styles.field}>
          <Text role="label-md" as="span" tone="muted">
            Durum
          </Text>
          <select
            className={styles.input}
            value={status}
            onChange={(event) => setStatus(event.target.value as LessonStatus)}
          >
            <option value="DRAFT">Taslak</option>
            <option value="PUBLISHED">Yayınlandı</option>
          </select>
        </label>
      </div>

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Vazgeç
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Kaydediliyor…' : lesson ? 'Güncelle' : 'Oluştur'}
        </Button>
      </div>
    </form>
  );
}

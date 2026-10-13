import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Text } from '../../../components';
import type { UserProfile } from '../../../types';
import type { ProfileUpdateInput } from '../../../data/useProfileData';
import styles from './ProfileEditForm.module.css';

const localeOptions: { value: string; label: string }[] = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
];

interface ProfileEditFormProps {
  profile: UserProfile;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (input: ProfileUpdateInput) => Promise<void>;
}

export function ProfileEditForm({ profile, saving, onCancel, onSubmit }: ProfileEditFormProps) {
  const [name, setName] = useState(profile.name);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? '');
  const [locale, setLocale] = useState(profile.locale);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({
      name: name.trim(),
      avatarUrl: avatarUrl.trim() === '' ? null : avatarUrl.trim(),
      locale,
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <Text role="label-md" as="span" tone="muted">
          Ad Soyad
        </Text>
        <input
          className={styles.input}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
        />
      </label>

      <label className={styles.field}>
        <Text role="label-md" as="span" tone="muted">
          Profil Fotoğrafı URL
        </Text>
        <input
          className={styles.input}
          type="url"
          placeholder="https://..."
          value={avatarUrl}
          onChange={(event) => setAvatarUrl(event.target.value)}
        />
      </label>

      <label className={styles.field}>
        <Text role="label-md" as="span" tone="muted">
          Dil
        </Text>
        <select
          className={styles.input}
          value={locale}
          onChange={(event) => setLocale(event.target.value)}
        >
          {localeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Vazgeç
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </form>
  );
}

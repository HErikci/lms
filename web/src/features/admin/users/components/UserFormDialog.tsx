import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Dialog, Text } from '../../../../components';
import type { AdminUser, UserRole } from '../../../../types';
import type { CreateUserInput, UpdateUserInput } from '../data/useAdminUsers';
import { ROLE_OPTIONS, generatePassword } from '../roles';
import styles from './UserFormDialog.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

interface UserFormDialogProps {
  /** Düzenlenen kullanıcı; yoksa yeni kullanıcı oluşturulur. */
  user: AdminUser | null;
  /** Oturumdaki yöneticinin kendisi mi (kendi ADMIN rolü ve durumu kilitlenir). */
  isSelf: boolean;
  onCreate: (input: CreateUserInput) => Promise<void>;
  onUpdate: (input: UpdateUserInput) => Promise<void>;
  onClose: () => void;
}

export function UserFormDialog({ user, isSelf, onCreate, onUpdate, onClose }: UserFormDialogProps) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [birthDate, setBirthDate] = useState(user?.birthDate?.slice(0, 10) ?? '');
  const [roles, setRoles] = useState<UserRole[]>(user?.roles ?? ['STUDENT']);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleRole = (role: UserRole, checked: boolean) =>
    setRoles((prev) => (checked ? [...prev, role] : prev.filter((r) => r !== role)));

  const fillGenerated = () => {
    setPassword(generatePassword());
    setShowPassword(true);
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Ad soyad zorunludur.';
    if (!EMAIL_RE.test(email.trim())) return 'Geçerli bir e-posta adresi girin.';
    if (roles.length === 0) return 'En az bir rol seçmelisiniz.';
    if (birthDate && (birthDate < '1900-01-01' || birthDate > new Date().toLocaleDateString('en-CA'))) {
      return '1900 yılından bugüne kadar geçerli bir doğum tarihi girin.';
    }
    if ((!user || password) && password.length < MIN_PASSWORD) {
      return `Şifre en az ${MIN_PASSWORD} karakter olmalıdır.`;
    }
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (user) {
        // Yalnızca değişen alanlar gönderilir.
        const input: UpdateUserInput = {};
        if (name.trim() !== user.name) input.name = name.trim();
        if (email.trim() !== user.email) input.email = email.trim();
        if ((birthDate || null) !== (user.birthDate?.slice(0, 10) ?? null)) input.birthDate = birthDate || null;
        const sameRoles = roles.length === user.roles.length && roles.every((r) => user.roles.includes(r));
        if (!sameRoles) input.roles = roles;
        if (password) input.password = password;
        if (Object.keys(input).length === 0) {
          onClose();
          return;
        }
        await onUpdate(input);
      } else {
        await onCreate({ name: name.trim(), email: email.trim(), password, roles, birthDate: birthDate || null });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem tamamlanamadı.');
      setBusy(false);
    }
  };

  return (
    <Dialog title={user ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı'} onClose={onClose} busy={busy}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <label className={styles.field}>
          <Text role="label-md" as="span" tone="muted">
            Ad soyad
          </Text>
          <input
            className={styles.input}
            type="text"
            value={name}
            maxLength={100}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
            required
            aria-required="true"
          />
        </label>

        <label className={styles.field}>
          <Text role="label-md" as="span" tone="muted">
            E-posta
          </Text>
          <input
            className={styles.input}
            type="email"
            value={email}
            autoComplete="off"
            onChange={(event) => setEmail(event.target.value)}
            required
            aria-required="true"
          />
        </label>

        <label className={styles.field}>
          <Text role="label-md" as="span" tone="muted">Doğum tarihi (isteğe bağlı)</Text>
          <input className={styles.input} type="date" value={birthDate} min="1900-01-01"
            max={new Date().toLocaleDateString('en-CA')} onChange={(event) => setBirthDate(event.target.value)} />
          <Text role="body-sm" as="span" tone="muted">18 yaşından küçük öğrenciler veli yönetiminden bir veliye bağlanabilir.</Text>
        </label>

        <fieldset className={styles.fieldset}>
          <legend>
            <Text role="label-md" as="span" tone="muted">
              Roller
            </Text>
          </legend>
          {ROLE_OPTIONS.map((option) => {
            const lockedAdmin = isSelf && option.value === 'ADMIN';
            return (
              <label key={option.value} className={styles.roleOption}>
                <input
                  type="checkbox"
                  checked={roles.includes(option.value)}
                  disabled={lockedAdmin}
                  onChange={(event) => toggleRole(option.value, event.target.checked)}
                />
                <span className={styles.roleText}>
                  <Text role="body-md" as="span" weight="semibold">
                    {option.label}
                  </Text>
                  <Text role="body-sm" as="span" tone="muted">
                    {lockedAdmin ? 'Kendi yönetici yetkinizi kaldıramazsınız.' : option.hint}
                  </Text>
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className={styles.field}>
          <label className={styles.field}>
            <Text role="label-md" as="span" tone="muted">
              {user ? 'Yeni şifre (boş bırakılırsa değişmez)' : 'Geçici şifre'}
            </Text>
            <input
              className={styles.input}
              type={showPassword ? 'text' : 'password'}
              value={password}
              autoComplete="new-password"
              spellCheck={false}
              onChange={(event) => setPassword(event.target.value)}
              required={!user}
              aria-required={!user}
            />
          </label>
          <div className={styles.passwordActions}>
            <Button variant="ghost" size="sm" iconStart="key" onClick={fillGenerated}>
              Şifre oluştur
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconStart={showPassword ? 'visibility_off' : 'visibility'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? 'Gizle' : 'Göster'}
            </Button>
          </div>
          <Text role="body-sm" as="p" tone="muted">
            En az {MIN_PASSWORD} karakter. Şifreyi kullanıcıya güvenli bir kanaldan iletin.
          </Text>
        </div>

        {error && (
          <div className={styles.error} role="alert">
            <Text role="body-sm" tone="error" as="p">
              {error}
            </Text>
          </div>
        )}

        <div className={styles.actions}>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            İptal
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Kaydediliyor…' : user ? 'Kaydet' : 'Kullanıcı Oluştur'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

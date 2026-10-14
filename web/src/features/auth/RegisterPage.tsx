import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../data/useAuth';
import { Button, Text } from '../../components';
import styles from './LoginPage.module.css';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }

    try {
      await register(email, password, name, birthDate || undefined);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt başarısız.');
    }
  }

  return (
    <form className={styles.container} onSubmit={handleSubmit}>
      <Text role="headline-sm" as="h1">Kayıt Ol</Text>
      <input
        className={styles.input}
        type="text"
        placeholder="Ad Soyad"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        className={styles.input}
        type="email"
        placeholder="E-posta"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        className={styles.input}
        type="password"
        placeholder="Şifre"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <input
        className={styles.input}
        type="password"
        placeholder="Şifre Tekrar"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
      />
      <label className={styles.field}>
        <Text role="body-sm" as="span">Doğum tarihi (isteğe bağlı)</Text>
        <input className={styles.input} type="date" value={birthDate} min="1900-01-01"
          max={new Date().toLocaleDateString('en-CA')} onChange={(event) => setBirthDate(event.target.value)} />
      </label>
      <Text role="body-sm" tone="muted">18 yaşından küçük öğrencilerin veli bağlantısını kurum yöneticisi oluşturur.</Text>
      {error && (
        <Text role="body-sm" tone="error" className={styles.error}>
          {error}
        </Text>
      )}
      <Button variant="primary" type="submit">Kayıt Ol</Button>
      <Text role="body-sm">
        Zaten hesabın var mı? <Link to="/giris">Giriş Yap</Link>
      </Text>
    </form>
  );
}

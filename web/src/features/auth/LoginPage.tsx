import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../data/useAuth';
import { Button, Text } from '../../components';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız.');
    }
  }

  return (
    <form className={styles.container} onSubmit={handleSubmit}>
      <Text role="headline-sm" as="h1">Giriş Yap</Text>
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
      {error && (
        <Text role="body-sm" tone="error" className={styles.error}>
          {error}
        </Text>
      )}
      <Button variant="primary" type="submit">Giriş Yap</Button>
    </form>
  );
}

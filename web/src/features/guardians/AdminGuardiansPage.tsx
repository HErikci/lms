import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Text } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import { apiFetch } from '../../lib/apiClient';
import { useApiResource } from '../../lib/useApiResource';
import { formatDate, notificationMessage } from './types';
import type { AdminGuardianLink, GuardianOptions, NotificationChannel, NotificationResult } from './types';
import styles from './Guardians.module.css';

export function AdminGuardiansPage() {
  const links = useApiResource<{ links: AdminGuardianLink[] }>('/api/v1/admin/guardians');
  const options = useApiResource<GuardianOptions>('/api/v1/admin/guardians/options');
  const [studentId, setStudentId] = useState('');
  const [guardianId, setGuardianId] = useState('');
  const [phone, setPhone] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const minorStudents = options.data?.students.filter((s) => s.isMinor) ?? [];
  const missingDates = options.data?.students.filter((s) => !s.birthDate).length ?? 0;
  const reload = () => { links.reload(); options.reload(); };
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null); setMessage(null);
    try {
      await apiFetch('/api/v1/admin/guardians', {
        method: 'POST', body: JSON.stringify({ studentId, guardianId, phone: phone.trim() || null, emailEnabled, smsEnabled }),
      });
      setMessage('Veli bağlantısı oluşturuldu.');
      setStudentId(''); setGuardianId(''); setPhone(''); setEmailEnabled(false); setSmsEnabled(false);
      reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'Veli bağlantısı oluşturulamadı.'); }
    finally { setBusy(false); }
  }
  async function remove(link: AdminGuardianLink) {
    if (!window.confirm(`${link.guardian.name} ile ${link.student.name} arasındaki veli bağlantısı kaldırılsın mı? Veli bu öğrencinin bilgilerine artık erişemez.`)) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      await apiFetch(`/api/v1/admin/guardians/${link.id}`, { method: 'DELETE' });
      setMessage('Veli bağlantısı kaldırıldı.'); reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'Veli bağlantısı kaldırılamadı.'); }
    finally { setBusy(false); }
  }
  async function notify(link: AdminGuardianLink, channel: NotificationChannel) {
    setBusy(true); setError(null); setMessage(null);
    try {
      const { notification } = await apiFetch<{ notification: NotificationResult }>(`/api/v1/admin/guardians/${link.id}/notify`, {
        method: 'POST', body: JSON.stringify({ channel }),
      });
      if (notification.status === 'FAILED') setError(notificationMessage(notification));
      else setMessage(notificationMessage(notification));
    } catch (err) { setError(err instanceof Error ? err.message : 'Rapor gönderilemedi.'); }
    finally { setBusy(false); }
  }
  const alreadyLinked = links.data?.links.some((l) => l.student.id === studentId && l.guardian.id === guardianId);
  return <PageContainer><div className={styles.page}>
    <div className={styles.header}><div><Text role="headline-lg" as="h1">Veli Yönetimi</Text>
      <Text role="body-md" tone="muted" as="p">18 yaşından küçük öğrencileri veli hesaplarına bağlayın ve eğitim raporlarını iletin.</Text></div>
      <Button variant="ghost" iconStart="refresh" onClick={reload} disabled={busy || links.loading || options.loading}>Yenile</Button></div>
    <div className={styles.notice}><Text role="body-sm" as="p">Önce <Link to="/yonetim/kullanicilar">Kullanıcı Yönetimi</Link> bölümünden veliye “Veli” rolünü verin ve öğrencinin doğum tarihini kaydedin. Veli bağlantısını, veli yetkisini doğruladıktan sonra oluşturun. Gönderim tercihlerini velinin onayına göre açın.</Text></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {message && <p role="status" className={styles.message}>{message}</p>}
    <Card padding="lg" elevation="1" className={styles.stack}><Text role="title-md" as="h2">Yeni veli bağlantısı</Text>
      {options.loading && <p role="status">Öğrenci ve veli seçenekleri yükleniyor…</p>}
      {options.error && <p role="alert" className={styles.error}>{options.error}</p>}
      {!options.loading && !options.error && options.data && <>
        {missingDates > 0 && <Text role="body-sm" tone="muted">{missingDates} öğrencinin doğum tarihi eksik; yaş doğrulaması için kullanıcı kaydını güncelleyin.</Text>}
        {!minorStudents.length && <Text role="body-sm" tone="muted">Doğum tarihi kayıtlı ve 18 yaşından küçük aktif öğrenci bulunmuyor.</Text>}
        {!options.data.guardians.length && <Text role="body-sm" tone="muted">Aktif veli hesabı bulunmuyor. Kullanıcı yönetiminden veli hesabı oluşturun.</Text>}
        <form className={styles.form} onSubmit={create}>
          <div className={styles.fields}>
            <label className={styles.field}>Öğrenci (18 yaşından küçük)
              <select className={styles.input} value={studentId} required disabled={busy} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">Öğrenci seçin</option>{minorStudents.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.email}</option>)}
              </select>
            </label>
            <label className={styles.field}>Veli hesabı
              <select className={styles.input} value={guardianId} required disabled={busy} onChange={(e) => setGuardianId(e.target.value)}>
                <option value="">Veli seçin</option>{options.data.guardians.map((g) => <option key={g.id} value={g.id} disabled={g.id === studentId}>{g.name} — {g.email}</option>)}
              </select>
            </label>
            <label className={styles.field}>Velinin SMS numarası (isteğe bağlı)
              <input className={styles.input} type="tel" placeholder="+905551234567" maxLength={16} pattern="\+[1-9][0-9]{7,14}" title="Ülke koduyla telefon numarası, örneğin +905551234567" value={phone} required={smsEnabled} disabled={busy} onChange={(e) => setPhone(e.target.value)} />
            </label>
          </div>
          <div className={styles.checks}>
            <label><input type="checkbox" checked={emailEnabled} disabled={busy} onChange={(e) => setEmailEnabled(e.target.checked)} />Veli e-posta raporlarına izin verdi</label>
            <label><input type="checkbox" checked={smsEnabled} disabled={busy} onChange={(e) => setSmsEnabled(e.target.checked)} />Veli SMS raporlarına izin verdi</label>
          </div>
          {alreadyLinked && <Text role="body-sm" tone="warning">Bu öğrenci ve veli zaten birbirine bağlı.</Text>}
          <div><Button type="submit" iconStart="person_add" disabled={busy || links.loading || !!links.error || !studentId || !guardianId || studentId === guardianId || alreadyLinked || (smsEnabled && !phone.trim())}>{busy ? 'İşlem yapılıyor…' : 'Veliye bağla'}</Button></div>
        </form>
      </>}
    </Card>
    <div className={styles.row}><Text role="title-md" as="h2">Veli bağlantıları ({links.data?.links.length ?? 0})</Text></div>
    {links.loading && <p role="status">Veli bağlantıları yükleniyor…</p>}
    {links.error && <p role="alert" className={styles.error}>{links.error}</p>}
    {!links.loading && !links.error && !links.data?.links.length && <Card padding="lg"><Text role="body-md">Henüz veli bağlantısı bulunmuyor.</Text></Card>}
    {!links.loading && !links.error && links.data?.links.map((link) => <Card key={link.id} padding="lg" className={styles.stack}>
      <div className={styles.row}><div><Text role="title-md" as="h3">{link.student.name}</Text><Text role="body-sm" tone="muted">{link.student.email} · Doğum: {formatDate(link.student.birthDate)}</Text></div>
        <Button variant="destructive" size="sm" disabled={busy} onClick={() => void remove(link)}>Bağlantıyı kaldır</Button></div>
      <Text role="body-md" as="p">Veli: {link.guardian.name} · {link.guardian.email}</Text>
      <Text role="body-sm" tone="muted">SMS numarası: {link.phone || 'Kayıtlı değil'} · E-posta: {link.emailEnabled ? 'İzin var' : 'Kapalı'} · SMS: {link.smsEnabled ? 'İzin var' : 'Kapalı'}</Text>
      <div className={styles.actions}><Button size="sm" iconStart="mail" disabled={busy || !link.emailEnabled} onClick={() => void notify(link, 'EMAIL')}>E-posta raporu gönder</Button>
        <Button size="sm" iconStart="sms" disabled={busy || !link.smsEnabled || !link.phone} onClick={() => void notify(link, 'SMS')}>SMS raporu gönder</Button></div>
    </Card>)}
  </div></PageContainer>;
}

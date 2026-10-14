import { useState, type FormEvent } from 'react';
import { Button, Card, ProgressBar, Text } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import { useApiResource } from '../../lib/useApiResource';
import { apiFetch } from '../../lib/apiClient';
import { formatDate, notificationMessage, notificationStatus } from './types';
import type { GuardianChild, GuardianLink, GuardianNotification, NotificationChannel, NotificationResult } from './types';
import styles from './Guardians.module.css';

function ChildReport({ child, onNotification, onPreferences }: {
  child: GuardianChild;
  onNotification: () => void;
  onPreferences: (link: GuardianLink) => void;
}) {
  const { link, report } = child;
  const [phone, setPhone] = useState(link.phone ?? '');
  const [emailEnabled, setEmailEnabled] = useState(link.emailEnabled);
  const [smsEnabled, setSmsEnabled] = useState(link.smsEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const dirty = phone.trim() !== (link.phone ?? '') || emailEnabled !== link.emailEnabled || smsEnabled !== link.smsEnabled;

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await apiFetch<{ link: GuardianLink }>(`/api/v1/guardian/links/${link.id}`, {
        method: 'PATCH', body: JSON.stringify({ phone: phone.trim() || null, emailEnabled, smsEnabled }),
      });
      setMessage('İletişim tercihleri kaydedildi.');
      setPhone(result.link.phone ?? '');
      setEmailEnabled(result.link.emailEnabled);
      setSmsEnabled(result.link.smsEnabled);
      onPreferences(result.link);
    } catch (err) { setError(err instanceof Error ? err.message : 'Tercihler kaydedilemedi.'); }
    finally { setBusy(false); }
  }
  async function notify(channel: NotificationChannel) {
    setBusy(true); setError(null); setMessage(null);
    try {
      const { notification } = await apiFetch<{ notification: NotificationResult }>(`/api/v1/guardian/children/${report.student.id}/notify`, {
        method: 'POST', body: JSON.stringify({ channel }),
      });
      if (notification.status === 'FAILED') setError(notificationMessage(notification));
      else setMessage(notificationMessage(notification));
    } catch (err) { setError(err instanceof Error ? err.message : 'Rapor gönderilemedi.'); }
    finally { setBusy(false); onNotification(); }
  }
  const examStatus: Record<string, string> = { IN_PROGRESS: 'Devam ediyor', SUBMITTED: 'Teslim edildi', GRADED: 'Notlandırıldı', EXPIRED: 'Süresi doldu' };

  return (
    <Card padding="lg" elevation="1" className={styles.stack}>
      <div className={styles.row}>
        <div><Text role="headline-sm" as="h2">{report.student.name}</Text>
          <Text role="body-sm" tone="muted">Doğum tarihi: {formatDate(report.student.birthDate)}</Text></div>
        <Text role="body-sm" tone="muted">Rapor tarihi: {formatDate(report.generatedAt, true)}</Text>
      </div>
      <div className={styles.stats}>
        <div><Text role="title-md">{report.courses.length}</Text><Text role="body-sm" tone="muted">Kayıtlı kurs</Text></div>
        <div><Text role="title-md">{Math.round(report.studySeconds / 60)} dk</Text><Text role="body-sm" tone="muted">Son 7 gün çalışma</Text></div>
        <div><Text role="title-md">{report.grades.length}</Text><Text role="body-sm" tone="muted">Ders notu</Text></div>
      </div>
      <div className={styles.section}>
        <Text role="title-md" as="h3">Kurs ilerlemesi</Text>
        {!report.courses.length && <Text role="body-sm" tone="muted">Henüz kayıtlı kurs bulunmuyor.</Text>}
        <div className={styles.reportGrid}>{report.courses.map((course) => <div className={styles.course} key={course.id}>
          <div className={styles.row}><Text role="body-md">{course.title}</Text><Text role="body-sm">%{course.progress.percent}</Text></div>
          <ProgressBar value={course.progress.percent} label={`${course.title} ilerlemesi`} />
          <Text role="body-sm" tone="muted">{course.progress.completedCount} / {course.progress.totalLessons} ders tamamlandı</Text>
        </div>)}</div>
      </div>
      <div className={styles.reportGrid}>
        <div className={styles.section}><Text role="title-md" as="h3">Ders notları</Text>
          {!report.grades.length ? <Text role="body-sm" tone="muted">Henüz not bulunmuyor.</Text> : <div className={styles.tableScroll}><table className={styles.table}>
            <thead><tr><th scope="col">Ders / Kurs</th><th scope="col">Not</th><th scope="col">Tarih</th></tr></thead>
            <tbody>{report.grades.map((grade, i) => <tr key={`${grade.lessonTitle}-${grade.gradedAt}-${i}`}>
              <td>{grade.lessonTitle}<div className={styles.muted}>{grade.courseTitle}</div></td><td>{grade.score}</td><td>{formatDate(grade.gradedAt)}</td>
            </tr>)}</tbody></table></div>}
        </div>
        <div className={styles.section}><Text role="title-md" as="h3">Sınav sonuçları</Text>
          {!report.exams.length ? <Text role="body-sm" tone="muted">Henüz sınav sonucu bulunmuyor.</Text> : <div className={styles.tableScroll}><table className={styles.table}>
            <thead><tr><th scope="col">Sınav / Kurs</th><th scope="col">Not</th><th scope="col">Durum</th></tr></thead>
            <tbody>{report.exams.map((exam, i) => <tr key={`${exam.title}-${exam.submittedAt}-${i}`}>
              <td>{exam.title}<div className={styles.muted}>{exam.courseTitle}</div></td><td>{exam.score ?? '—'}</td><td>{examStatus[exam.status] ?? exam.status}</td>
            </tr>)}</tbody></table></div>}
        </div>
      </div>
      <form onSubmit={save} className={styles.section}>
        <Text role="title-md" as="h3">Rapor alma tercihleri</Text>
        <label className={styles.field}>SMS telefon numarası
          <input className={styles.input} type="tel" autoComplete="tel" maxLength={16} pattern="\+[1-9][0-9]{7,14}" title="Ülke koduyla telefon numarası, örneğin +905551234567" required={smsEnabled} placeholder="+905551234567" value={phone} disabled={busy} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <div className={styles.checks}>
          <label><input type="checkbox" checked={emailEnabled} disabled={busy} onChange={(e) => setEmailEnabled(e.target.checked)} />E-posta ile rapor almayı kabul ediyorum</label>
          <label><input type="checkbox" checked={smsEnabled} disabled={busy} onChange={(e) => setSmsEnabled(e.target.checked)} />SMS ile rapor almayı kabul ediyorum</label>
        </div>
        <Text role="body-sm" tone="muted">E-posta hesabınızdaki adrese, SMS bu numaraya gönderilir. Raporu aşağıdaki düğmelerle talep edebilirsiniz. {dirty && 'Göndermeden önce tercihlerinizi kaydedin.'}</Text>
        <div className={styles.actions}>
          <Button type="submit" variant="secondary" disabled={busy || !dirty || (smsEnabled && !phone.trim())}>Tercihleri kaydet</Button>
          <Button iconStart="mail" disabled={busy || dirty || !link.emailEnabled} onClick={() => void notify('EMAIL')}>E-posta gönder</Button>
          <Button iconStart="sms" disabled={busy || dirty || !link.smsEnabled || !link.phone} onClick={() => void notify('SMS')}>SMS gönder</Button>
        </div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {message && <p role="status" className={styles.message}>{message}</p>}
      </form>
    </Card>
  );
}

export function GuardianPage() {
  const children = useApiResource<{ children: GuardianChild[] }>('/api/v1/guardian/children');
  const notifications = useApiResource<{ notifications: GuardianNotification[] }>('/api/v1/guardian/notifications');
  const reload = () => { children.reload(); notifications.reload(); };
  return <PageContainer><div className={styles.page}>
    <div className={styles.header}><div><Text role="headline-lg" as="h1">Veli Paneli</Text>
      <Text role="body-md" tone="muted" as="p">Çocuğunuzun kurslarını, ilerlemesini, notlarını ve sınav sonuçlarını takip edin.</Text></div>
      <Button variant="ghost" iconStart="refresh" onClick={reload} disabled={children.loading || notifications.loading}>Yenile</Button></div>
    {children.loading && <p role="status">Çocuk bilgileri yükleniyor…</p>}
    {children.error && <p role="alert" className={styles.error}>{children.error}</p>}
    {!children.loading && !children.error && children.data?.children.length === 0 && <Card padding="lg"><Text role="body-md" as="p">Hesabınıza bağlı çocuk bulunmuyor. Kurum yöneticisi, doğum tarihi kayıtlı ve 18 yaşından küçük öğrencinizi veli hesabınıza bağlayabilir.</Text></Card>}
    {!children.loading && !children.error && children.data?.children.map((child) => <ChildReport key={child.link.id} child={child}
      onNotification={notifications.reload}
      onPreferences={(link) => children.setData((current) => current ? { children: current.children.map((entry) => entry.link.id === link.id ? { ...entry, link } : entry) } : current)} />)}
    <Card padding="lg" elevation="1" className={styles.stack}><Text role="title-md" as="h2">Gönderim geçmişi</Text>
      {notifications.loading && <p role="status">Gönderimler yükleniyor…</p>}
      {notifications.error && <p role="alert" className={styles.error}>{notifications.error}</p>}
      {!notifications.loading && !notifications.error && !notifications.data?.notifications.length && <Text role="body-sm" tone="muted">Henüz rapor gönderimi bulunmuyor.</Text>}
      {!notifications.loading && !notifications.error && !!notifications.data?.notifications.length && <div className={styles.tableScroll}><table className={styles.table}>
        <thead><tr><th scope="col">Öğrenci</th><th scope="col">Kanal</th><th scope="col">Durum</th><th scope="col">Tarih</th></tr></thead>
        <tbody>{notifications.data.notifications.map((n) => <tr key={n.id}><td>{n.student.name}</td><td>{n.channel === 'EMAIL' ? 'E-posta' : 'SMS'}</td><td>{notificationStatus[n.status]}{n.error && <div className={styles.error}>{n.error}</div>}</td><td>{formatDate(n.sentAt ?? n.createdAt, true)}</td></tr>)}</tbody>
      </table></div>}
    </Card>
  </div></PageContainer>;
}

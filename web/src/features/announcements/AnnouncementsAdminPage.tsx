import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, IconButton, Text } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import { useCurrentUser } from '../../data/useCurrentUser';
import type { AnnouncementItem, AnnouncementState } from '../../types';
import { useEventCourses } from '../calendar/useEventCourses';
import { AnnouncementFormDialog } from './AnnouncementFormDialog';
import type { CourseOption } from './AnnouncementFormDialog';
import { CATEGORIES, STATES, STATE_KEYS, formatDateTime, formatRelative } from './announcementMeta';
import {
  createAnnouncement,
  deleteAnnouncement,
  updateAnnouncement,
  useManagedAnnouncements,
} from './useAnnouncements';
import type { AnnouncementPayload } from './useAnnouncements';
import styles from './AnnouncementsAdminPage.module.css';

/** Durum satırındaki tarih açıklaması. */
function describeTiming(announcement: AnnouncementItem): string {
  switch (announcement.state) {
    case 'DRAFT':
      return `Son düzenleme ${formatRelative(announcement.updatedAt)}`;
    case 'SCHEDULED':
      return `${formatDateTime(announcement.publishAt!)} tarihinde yayınlanacak`;
    case 'EXPIRED':
      return `${formatDateTime(announcement.expiresAt!)} tarihinde yayından kalktı`;
    default:
      return announcement.expiresAt
        ? `${formatRelative(announcement.publishAt!)} yayınlandı · ${formatDateTime(announcement.expiresAt)} tarihinde kalkacak`
        : `${formatRelative(announcement.publishAt!)} yayınlandı`;
  }
}

export function AnnouncementsAdminPage() {
  const { user } = useCurrentUser();
  const courses = useEventCourses(user);
  const { announcements, loading, error, reload } = useManagedAnnouncements();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<AnnouncementState | 'ALL'>('ALL');
  // undefined = kapalı, null = yeni duyuru, nesne = düzenleme.
  const [editing, setEditing] = useState<AnnouncementItem | null | undefined>(undefined);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const defaultCourseId = isAdmin ? null : (courses[0]?.id ?? null);

  // Detay sayfasındaki "Düzenle" bağlantısı: /yonetim/duyurular?duzenle=<id>
  const editId = searchParams.get('duzenle');
  useEffect(() => {
    if (!editId || loading) return;
    const target = announcements.find((a) => a.id === editId);
    if (target) setEditing(target);
    setSearchParams({}, { replace: true });
  }, [editId, loading, announcements, setSearchParams]);

  const counts = useMemo(() => {
    const result: Record<AnnouncementState, number> = { DRAFT: 0, SCHEDULED: 0, PUBLISHED: 0, EXPIRED: 0 };
    for (const a of announcements) result[a.state] += 1;
    return result;
  }, [announcements]);

  const visible = filter === 'ALL' ? announcements : announcements.filter((a) => a.state === filter);

  // Düzenlenen duyurunun kursu seçenekler arasında yoksa (ör. başka eğitmenin eklediği) listeye eklenir.
  const courseOptions = useMemo<CourseOption[]>(() => {
    const course = editing?.course;
    return course && !courses.some((c) => c.id === course.id) ? [...courses, course] : courses;
  }, [courses, editing]);

  const close = () => setEditing(undefined);

  const handleSave = async (payload: AnnouncementPayload) => {
    if (editing) await updateAnnouncement(editing.id, payload);
    else await createAnnouncement(payload);
    close();
    await reload();
  };

  const handleDelete = async () => {
    if (!editing) return;
    await deleteAnnouncement(editing.id);
    close();
    await reload();
  };

  const quickUpdate = async (announcement: AnnouncementItem, payload: Partial<AnnouncementPayload>) => {
    setBusyId(announcement.id);
    setActionError(null);
    try {
      await updateAnnouncement(announcement.id, payload);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'İşlem tamamlanamadı.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageContainer>
      <div className={styles.header}>
        <div>
          <Text role="headline-lg" as="h1">
            Duyuru Yönetimi
          </Text>
          <Text role="body-md" tone="muted" as="p">
            {isAdmin
              ? 'Genel ve kurs duyurularını hazırlayın, zamanlayın ve yayınlayın.'
              : 'Eğitmeni olduğunuz kursların duyurularını hazırlayın, zamanlayın ve yayınlayın.'}
          </Text>
        </div>
        <div className={styles.headerActions}>
          <Link to="/duyurular" className={styles.viewLink}>
            Öğrenci görünümü
          </Link>
          <Button
            variant="primary"
            iconStart="add"
            disabled={!isAdmin && courses.length === 0}
            onClick={() => setEditing(null)}
          >
            Yeni Duyuru
          </Button>
        </div>
      </div>

      <div className={styles.tabs} role="group" aria-label="Duruma göre süz">
        <button type="button" className={styles.tab} aria-pressed={filter === 'ALL'} onClick={() => setFilter('ALL')}>
          Tümü <span className={styles.count}>{announcements.length}</span>
        </button>
        {STATE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={styles.tab}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {STATES[key].label} <span className={styles.count}>{counts[key]}</span>
          </button>
        ))}
      </div>

      <div aria-live="polite" className={styles.live}>
        {(error || actionError) && (
          <Text role="body-md" tone="error" as="p" className={styles.message}>
            {error ?? actionError}
          </Text>
        )}
      </div>
      {loading && announcements.length === 0 && (
        <Text role="body-md" tone="muted" as="p">
          Yükleniyor…
        </Text>
      )}
      {!loading && !error && visible.length === 0 && (
        <Card padding="lg" elevation="1">
          <Text role="body-md" tone="muted" as="p">
            {filter === 'ALL' ? 'Henüz duyuru yok. "Yeni Duyuru" ile ilkini oluşturun.' : 'Bu durumda duyuru yok.'}
          </Text>
        </Card>
      )}

      <ul className={styles.list}>
        {visible.map((a) => {
          const state = STATES[a.state];
          const category = CATEGORIES[a.category];
          const busy = busyId === a.id;
          return (
            <li key={a.id}>
              <Card padding="md" elevation="1" className={styles.row}>
                <div className={styles.info}>
                  <div className={styles.badges}>
                    <Badge tone={state.tone} icon={state.icon}>
                      {state.label}
                    </Badge>
                    <Badge tone={category.badgeTone} variant="soft">
                      {category.label}
                    </Badge>
                    <Badge tone="neutral" icon={a.course ? 'menu_book' : 'public'}>
                      {a.course?.title ?? 'Genel'}
                    </Badge>
                    {a.pinned && (
                      <Badge tone="secondary" icon="push_pin">
                        Sabit
                      </Badge>
                    )}
                  </div>
                  <Text role="title-md" as="h2" tone="main" className={styles.title}>
                    {a.state === 'PUBLISHED' ? <Link to={`/duyurular/${a.id}`}>{a.title}</Link> : a.title}
                  </Text>
                  <Text role="body-sm" tone="muted">
                    {a.author?.name ?? 'Bilinmeyen yazar'} · {describeTiming(a)}
                  </Text>
                </div>

                <div className={styles.actions}>
                  <IconButton
                    icon="push_pin"
                    label={a.pinned ? `Sabitlemeyi kaldır: ${a.title}` : `Sabitle: ${a.title}`}
                    aria-pressed={a.pinned}
                    className={a.pinned ? styles.activeIcon : undefined}
                    disabled={busy}
                    onClick={() => void quickUpdate(a, { pinned: !a.pinned })}
                  />
                  {a.state === 'DRAFT' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      iconStart="publish"
                      disabled={busy}
                      onClick={() => void quickUpdate(a, { status: 'PUBLISHED' })}
                    >
                      Yayınla
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconStart="unpublished"
                      disabled={busy}
                      onClick={() => void quickUpdate(a, { status: 'DRAFT' })}
                    >
                      Taslağa al
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" iconStart="edit" disabled={busy} onClick={() => setEditing(a)}>
                    Düzenle
                  </Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      {editing !== undefined && (
        <AnnouncementFormDialog
          announcement={editing}
          courses={courseOptions}
          canCreateGeneral={isAdmin}
          defaultCourseId={defaultCourseId}
          onSave={handleSave}
          onDelete={editing ? handleDelete : undefined}
          onClose={close}
        />
      )}
    </PageContainer>
  );
}

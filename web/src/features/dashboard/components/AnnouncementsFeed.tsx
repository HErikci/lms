import { Link } from 'react-router-dom';
import { Icon, Panel, Text } from '../../../components';
import type { Announcement } from '../../../types';
import styles from './AnnouncementsFeed.module.css';

interface AnnouncementsFeedProps {
  announcements: Announcement[];
}

export function AnnouncementsFeed({ announcements }: AnnouncementsFeedProps) {
  return (
    <Panel
      title="Duyurular"
      icon="campaign"
      iconTone="secondary"
      action={
        <Link to="/duyurular" className={styles.seeAll}>
          <Text role="label-md" tone="inherit">
            Tümü
          </Text>
          <Icon name="arrow_forward" size="sm" />
        </Link>
      }
    >
      {announcements.length === 0 && (
        <Text role="body-sm" tone="muted" as="p">
          Yayında duyuru yok.
        </Text>
      )}
      <ul className={styles.list}>
        {announcements.map((announcement) => (
          <li key={announcement.id} className={styles.item}>
            <span
              className={[styles.dot, styles[`dot-${announcement.tone}`]].join(' ')}
              aria-hidden="true"
            />
            <span className={styles.text}>
              <Link to={`/duyurular/${announcement.id}`} className={styles.title}>
                <Text role="label-lg" tone="inherit">
                  {announcement.title}
                </Text>
              </Link>
              <Text role="body-sm" tone="muted">
                {announcement.source} · {announcement.timeAgo}
              </Text>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

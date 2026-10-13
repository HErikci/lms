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
        <a href="#" className={styles.seeAll}>
          <Text role="label-md" tone="inherit">
            Tümü
          </Text>
          <Icon name="arrow_forward" size="sm" />
        </a>
      }
    >
      <ul className={styles.list}>
        {announcements.map((announcement) => (
          <li key={announcement.id} className={styles.item}>
            <span
              className={[styles.dot, styles[`dot-${announcement.tone}`]].join(' ')}
              aria-hidden="true"
            />
            <span className={styles.text}>
              <a href="#" className={styles.title}>
                <Text role="label-lg" tone="inherit">
                  {announcement.title}
                </Text>
              </a>
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

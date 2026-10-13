import type { ReactNode } from 'react';
import { Card } from '../Card';
import { Icon } from '../Icon';
import { Text } from '../Text';
import styles from './Panel.module.css';

export type PanelIconTone = 'secondary' | 'cyan' | 'warning' | 'success';

interface PanelProps {
  title: string;
  icon?: string;
  iconTone?: PanelIconTone;
  /** Başlığın sağındaki rozet ya da bağlantı. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Başlıklı yan panel: Yaklaşan Görevler, Duyurular gibi listeler için. */
export function Panel({
  title,
  icon,
  iconTone = 'secondary',
  action,
  className,
  children,
}: PanelProps) {
  return (
    <Card padding="md" className={[styles.panel, className].filter(Boolean).join(' ')}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          {icon ? (
            <Icon name={icon} size="lg" filled className={styles[`tone-${iconTone}`]} />
          ) : null}
          <Text role="headline-sm" as="h2" tone="navy" weight="bold">
            {title}
          </Text>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

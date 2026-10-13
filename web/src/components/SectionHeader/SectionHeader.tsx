import type { ReactNode } from 'react';
import { Text } from '../Text';
import styles from './SectionHeader.module.css';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  /** Sağda yer alan eylem — genelde "Tümünü Gör" türü bir bağlantı. */
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, action, className }: SectionHeaderProps) {
  return (
    <div className={[styles.header, className].filter(Boolean).join(' ')}>
      <div className={styles.titles}>
        <Text role="headline-sm" as="h2" tone="navy" weight="bold">
          {title}
        </Text>
        {subtitle ? (
          <Text role="body-sm" as="p" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </div>
      {action}
    </div>
  );
}

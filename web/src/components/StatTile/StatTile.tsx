import type { ReactNode } from 'react';
import { Card } from '../Card';
import { Icon } from '../Icon';
import { Text } from '../Text';
import styles from './StatTile.module.css';

export type StatTone = 'secondary' | 'cyan' | 'success' | 'warning';

interface StatTileProps {
  label: string;
  value: string;
  /** Değerin yanındaki küçük birim, ör. "/62", "Saat / Bu Ay". */
  unit?: ReactNode;
  icon: string;
  iconTone?: StatTone;
  /** Değerin altındaki trend satırı ya da ilerleme çubuğu. */
  footer?: ReactNode;
}

export function StatTile({
  label,
  value,
  unit,
  icon,
  iconTone = 'secondary',
  footer,
}: StatTileProps) {
  return (
    <Card padding="md" interactive className={styles.tile}>
      <div className={styles.body}>
        <Text role="label-md" as="p" tone="muted" className={styles.label}>
          {label}
        </Text>
        <p className={styles.valueRow}>
          <Text role="headline-lg" tone="navy" weight="bold">
            {value}
          </Text>
          {unit ? (
            <Text role="label-md" tone="muted" className={styles.unit}>
              {unit}
            </Text>
          ) : null}
        </p>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
      <span className={[styles.iconTile, styles[`tone-${iconTone}`]].join(' ')}>
        <Icon name={icon} size="lg" />
      </span>
    </Card>
  );
}

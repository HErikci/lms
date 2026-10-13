import type { ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './Badge.module.css';

export type BadgeTone =
  | 'brand'
  | 'info'
  | 'cyan'
  | 'success'
  | 'warning'
  | 'error'
  | 'neutral'
  | 'navy';

/**
 * solid = dolu zemin, soft = renkli zeminin saydam tonu,
 * glass = koyu/gradient yüzeyler üzerinde buzlu cam etkisi.
 */
export type BadgeVariant = 'solid' | 'soft' | 'glass';

export type BadgeShape = 'pill' | 'rounded';

interface BadgeProps {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  shape?: BadgeShape;
  icon?: string;
  iconFilled?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({
  tone = 'neutral',
  variant = 'soft',
  shape = 'pill',
  icon,
  iconFilled = false,
  className,
  children,
}: BadgeProps) {
  const classes = [
    styles.badge,
    'label-md',
    styles[`${variant}-${tone}`],
    styles[`shape-${shape}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      {icon ? <Icon name={icon} size="sm" filled={iconFilled} /> : null}
      {children}
    </span>
  );
}

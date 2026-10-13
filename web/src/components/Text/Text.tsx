import type { ElementType, ReactNode } from 'react';
import styles from './Text.module.css';

/** DESIGN.md'de tanımlı 13 tipografi rolü. */
export type TextRole =
  | 'display-hero'
  | 'headline-lg'
  | 'headline-md'
  | 'headline-sm'
  | 'title-md'
  | 'body-lg'
  | 'body-md'
  | 'body-sm'
  | 'label-lg'
  | 'label-md'
  | 'code-sm';

export type TextTone =
  | 'default'
  | 'muted'
  | 'main'
  | 'navy'
  | 'primary'
  | 'secondary'
  | 'cyan'
  | 'success'
  | 'warning'
  | 'error'
  | 'on-primary'
  | 'inherit';

interface TextProps {
  role: TextRole;
  as?: ElementType;
  tone?: TextTone;
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  truncate?: boolean;
  className?: string;
  children: ReactNode;
}

export function Text({
  role,
  as: Component = 'span',
  tone = 'default',
  weight,
  truncate = false,
  className,
  children,
}: TextProps) {
  const classes = [
    role,
    styles[`tone-${tone}`],
    weight ? styles[`weight-${weight}`] : null,
    truncate ? styles.truncate : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <Component className={classes}>{children}</Component>;
}

import type { ElementType, ReactNode } from 'react';
import styles from './Card.module.css';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  as?: ElementType;
  padding?: CardPadding;
  /** Hover'da yükselti artışı — tıklanabilir kartlar için. */
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}

export function Card({
  as: Component = 'div',
  padding = 'lg',
  interactive = false,
  className,
  children,
}: CardProps) {
  const classes = [
    styles.card,
    styles[`padding-${padding}`],
    interactive ? styles.interactive : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <Component className={classes}>{children}</Component>;
}

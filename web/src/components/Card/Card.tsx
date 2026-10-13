import type { ElementType, ReactNode } from 'react';
import styles from './Card.module.css';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardElevation = '1' | '2' | '3';

interface CardProps {
  as?: ElementType;
  padding?: CardPadding;
  elevation?: CardElevation;
  /** Hover'da yükselti artışı — tıklanabilir kartlar için. */
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}

export function Card({
  as: Component = 'div',
  padding = 'lg',
  elevation = '1',
  interactive = false,
  className,
  children,
}: CardProps) {
  const classes = [
    styles.card,
    styles[`padding-${padding}`],
    styles[`elevation-${elevation}`],
    interactive ? styles.interactive : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <Component className={classes}>{children}</Component>;
}

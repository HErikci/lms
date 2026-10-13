import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'navy' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Material Symbols adı; etiketin soluna yerleşir. */
  iconStart?: string;
  iconEnd?: string;
  iconFilled?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  iconStart,
  iconEnd,
  iconFilled = false,
  fullWidth = false,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[`size-${size}`],
    fullWidth ? styles.fullWidth : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {iconStart ? <Icon name={iconStart} size="md" filled={iconFilled} /> : null}
      <span>{children}</span>
      {iconEnd ? <Icon name={iconEnd} size="sm" /> : null}
    </button>
  );
}

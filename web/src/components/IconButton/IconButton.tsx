import type { ButtonHTMLAttributes } from 'react';
import { Icon } from '../Icon';
import styles from './IconButton.module.css';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  /** Erişilebilir ad — görsel etiket olmadığı için zorunlu. */
  label: string;
  /** Okunmamış bildirim noktası. */
  showDot?: boolean;
}

export function IconButton({ icon, label, showDot = false, className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      className={[styles.iconButton, className].filter(Boolean).join(' ')}
      aria-label={label}
      {...rest}
    >
      <Icon name={icon} size="lg" />
      {showDot ? <span className={styles.dot} aria-hidden="true" /> : null}
    </button>
  );
}

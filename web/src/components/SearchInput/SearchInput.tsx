import type { InputHTMLAttributes } from 'react';
import { Icon } from '../Icon';
import styles from './SearchInput.module.css';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export function SearchInput({ label, className, ...rest }: SearchInputProps) {
  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      <Icon name="search" size="md" className={styles.icon} />
      <input type="search" className={styles.input} aria-label={label} {...rest} />
    </div>
  );
}

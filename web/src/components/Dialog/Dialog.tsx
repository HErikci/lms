import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Text } from '../Text';
import styles from './Dialog.module.css';

export type DialogSize = 'sm' | 'md' | 'lg';

interface DialogProps {
  title: string;
  /** Esc, arka plan tıklaması ve kapatma isteği. `busy` iken çağrılmaz. */
  onClose: () => void;
  /** İşlem sürerken kapatma engellenir. */
  busy?: boolean;
  size?: DialogSize;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Erişilebilir modal: body'ye portal, odak tuzağı (Tab/Shift+Tab), Esc ile kapanma,
 * açılışta ilk odaklanabilir öğeye odak, kapanışta odağın önceki öğeye dönmesi.
 */
export function Dialog({ title, onClose, busy = false, size = 'md', children }: DialogProps) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => previous?.focus?.();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!busy) onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!nodes || nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className={styles.scrim}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={[styles.dialog, styles[size]].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onKeyDown={handleKeyDown}
      >
        <Text role="headline-sm" as="h2" className={styles.title}>
          <span id={headingId}>{title}</span>
        </Text>
        {children}
      </div>
    </div>,
    document.body,
  );
}

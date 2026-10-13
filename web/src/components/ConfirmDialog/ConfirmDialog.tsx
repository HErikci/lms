import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { Text } from '../Text';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** Geri alınamaz işlemler için kırmızı onay düğmesi. */
  destructive?: boolean;
  /** Hata fırlatırsa mesaj diyalogda gösterilir ve diyalog açık kalır. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({ title, children, confirmLabel, destructive = false, onConfirm, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem tamamlanamadı.');
      setBusy(false);
    }
  };

  return (
    <Dialog title={title} size="sm" busy={busy} onClose={onClose}>
      <div className={styles.body}>{children}</div>
      {error && (
        <div className={styles.error} role="alert">
          <Text role="body-sm" tone="error" as="p">
            {error}
          </Text>
        </div>
      )}
      <div className={styles.actions}>
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          Vazgeç
        </Button>
        <Button variant={destructive ? 'destructive' : 'primary'} disabled={busy} onClick={() => void confirm()}>
          {busy ? 'İşleniyor…' : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

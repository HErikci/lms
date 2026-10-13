import styles from './ProgressBar.module.css';

export type ProgressTone = 'gradient' | 'cyan' | 'blue' | 'success' | 'warning';
export type ProgressSize = 'sm' | 'md';

interface ProgressBarProps {
  /** 0–100 arası tamamlanma yüzdesi. */
  value: number;
  tone?: ProgressTone;
  size?: ProgressSize;
  /** Ekran okuyucu için anlamlı ad, ör. "Modül tamamlanma oranı". */
  label: string;
  className?: string;
}

export function ProgressBar({
  value,
  tone = 'gradient',
  size = 'md',
  label,
  className,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div
      className={[styles.track, styles[`size-${size}`], className].filter(Boolean).join(' ')}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={[styles.fill, styles[tone]].join(' ')} style={{ width: `${clamped}%` }} />
    </div>
  );
}

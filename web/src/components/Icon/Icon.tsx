import styles from './Icon.module.css';

export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

interface IconProps {
  /** Material Symbols Outlined ligatür adı, ör. "grid_view". */
  name: string;
  size?: IconSize;
  filled?: boolean;
  className?: string;
  /** Anlam taşıyan ikonlar için; verilmezse ikon dekoratif kabul edilir. */
  label?: string;
}

export function Icon({ name, size = 'md', filled = false, className, label }: IconProps) {
  const classes = [
    'material-symbols-outlined',
    styles.icon,
    styles[`size-${size}`],
    filled ? styles.filled : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={classes}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {name}
    </span>
  );
}

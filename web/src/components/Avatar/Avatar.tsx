import { Icon } from '../Icon';
import styles from './Avatar.module.css';

interface AvatarProps {
  name: string;
  src?: string;
  className?: string;
}

export function Avatar({ name, src, className }: AvatarProps) {
  return (
    <span className={[styles.avatar, className].filter(Boolean).join(' ')}>
      {src ? (
        <img src={src} alt={name} className={styles.image} />
      ) : (
        <Icon name="person" size="md" />
      )}
    </span>
  );
}

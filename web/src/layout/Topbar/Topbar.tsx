import { Avatar, IconButton, SearchInput, Text } from '../../components';
import type { StudentProfile } from '../../types';
import styles from './Topbar.module.css';

interface TopbarProps {
  student: StudentProfile;
  onMenuToggle: () => void;
  isMenuOpen: boolean;
}

export function Topbar({ student, onMenuToggle, isMenuOpen }: TopbarProps) {
  return (
    <header className={styles.topbar}>
      <IconButton
        icon={isMenuOpen ? 'close' : 'menu'}
        label={isMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
        onClick={onMenuToggle}
        aria-expanded={isMenuOpen}
        className={styles.menuButton}
      />

      <div className={styles.search}>
        <SearchInput label="Ara" placeholder="Ders, içerik, hoca veya ödev ara..." />
      </div>

      <div className={styles.actions}>
        <IconButton icon="notifications" label="Bildirimler" showDot />
        <IconButton icon="chat_bubble" label="Mesajlar" />
        <span className={styles.divider} aria-hidden="true" />
        <div className={styles.user}>
          <Avatar name={student.fullName} src={student.avatarUrl} />
          <span className={styles.userText}>
            <Text role="label-lg" tone="main">
              {student.fullName}
            </Text>
            <Text role="body-sm" tone="muted">
              {student.studentNumber}
            </Text>
          </span>
        </div>
      </div>
    </header>
  );
}

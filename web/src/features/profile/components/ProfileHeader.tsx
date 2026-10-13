import { Avatar, Badge, Text } from '../../../components';
import type { UserProfile } from '../../../types';
import styles from './ProfileHeader.module.css';

const roleLabels: Record<UserProfile['role'], string> = {
  STUDENT: 'Öğrenci',
  INSTRUCTOR: 'Eğitmen',
  ADMIN: 'Yönetici',
};

function formatMemberSince(isoDate: string) {
  try {
    return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(
      new Date(isoDate),
    );
  } catch {
    return isoDate;
  }
}

interface ProfileHeaderProps {
  profile: UserProfile;
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  return (
    <div className={styles.header}>
      <Avatar name={profile.name} src={profile.avatarUrl ?? undefined} className={styles.avatar} />
      <div className={styles.info}>
        <div className={styles.nameRow}>
          <Text role="headline-md" as="h1" tone="main" weight="bold">
            {profile.name}
          </Text>
          <Badge tone="secondary" variant="soft">
            {roleLabels[profile.role]}
          </Badge>
        </div>
        <Text role="body-md" tone="muted">
          {profile.email}
        </Text>
        <Text role="body-sm" tone="muted">
          Üyelik tarihi: {formatMemberSince(profile.createdAt)}
        </Text>
      </div>
    </div>
  );
}

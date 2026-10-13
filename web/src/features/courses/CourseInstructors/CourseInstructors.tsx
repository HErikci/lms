import { Avatar, Text } from '../../../components';
import type { CourseInstructor } from '../../../types';
import styles from './CourseInstructors.module.css';

interface CourseInstructorsProps {
  instructors?: CourseInstructor[];
  /** Eğitmen yoksa "Eğitmen atanmamış" göster (kartlarda gizlemek için false). */
  showEmpty?: boolean;
}

const MAX_NAMES = 2;

/** Eğitmen adları (baş eğitmen önce) ve küçük avatarlar; 2den fazlaysa "+N". */
export function CourseInstructors({ instructors, showEmpty = true }: CourseInstructorsProps) {
  const list = instructors ?? [];
  if (list.length === 0) {
    return showEmpty && instructors ? (
      <Text role="body-sm" tone="muted" as="p">
        Eğitmen atanmamış
      </Text>
    ) : null;
  }

  const shown = list.slice(0, MAX_NAMES);
  const extra = list.length - shown.length;

  return (
    <div className={styles.root}>
      <div className={styles.avatars}>
        {shown.map((instructor) => (
          <Avatar
            key={instructor.id}
            name={instructor.name}
            src={instructor.avatarUrl ?? undefined}
            className={styles.avatar}
          />
        ))}
      </div>
      <Text role="body-sm" tone="muted" as="span">
        {shown.map((instructor) => instructor.name).join(', ')}
        {extra > 0 ? ` +${extra}` : ''}
      </Text>
    </div>
  );
}

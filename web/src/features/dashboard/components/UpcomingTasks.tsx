import { Badge, Icon, Panel, Text } from '../../../components';
import type { UpcomingTask } from '../../../types';
import styles from './UpcomingTasks.module.css';

interface UpcomingTasksProps {
  tasks: UpcomingTask[];
}

/** Teslim tarihi yaklaşan ödev ve sınavlar — FR-12. */
export function UpcomingTasks({ tasks }: UpcomingTasksProps) {
  return (
    <Panel
      title="Yaklaşan Görevler"
      icon="pending_actions"
      iconTone="warning"
      action={
        <Badge tone="warning" variant="soft">
          {tasks.length} Teslim
        </Badge>
      }
    >
      <ul className={styles.list}>
        {tasks.map((task) => (
          <li key={task.id} className={styles.item}>
            <div className={styles.itemHeader}>
              <Badge tone={task.tagTone} variant="soft" shape="rounded" icon={task.tagIcon}>
                {task.tagLabel}
              </Badge>
              <Text role="label-md" tone="muted">
                {task.dueLabel}
              </Text>
            </div>

            <div className={styles.itemBody}>
              <Text role="label-lg" as="h3" tone="main">
                {task.title}
              </Text>
              <Text role="body-sm" as="p" tone="muted">
                {task.description}
              </Text>
            </div>

            <div className={styles.itemFooter}>
              <span className={styles.meta}>
                <Icon name={task.metaIcon} size="sm" />
                <Text role="body-sm" tone="muted">
                  {task.metaLabel}
                </Text>
                {task.durationLabel ? (
                  <Text role="body-sm" tone="muted">
                    {task.durationLabel}
                  </Text>
                ) : null}
              </span>

              <a href="#" className={styles.action}>
                <Text role="label-md" tone="inherit">
                  {task.actionLabel}
                </Text>
                <Icon name="arrow_forward" size="sm" />
              </a>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

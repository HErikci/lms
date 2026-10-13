import { Icon, ProgressBar, StatTile, Text } from '../../../components';
import type { KpiMetric } from '../../../types';
import styles from './KpiGrid.module.css';

interface KpiGridProps {
  metrics: KpiMetric[];
}

export function KpiGrid({ metrics }: KpiGridProps) {
  return (
    <div className={styles.grid}>
      {metrics.map((metric) => (
        <StatTile
          key={metric.id}
          label={metric.label}
          value={metric.value}
          unit={metric.unit}
          icon={metric.icon}
          iconTone={metric.iconTone}
          footer={
            metric.progress !== undefined ? (
              <ProgressBar
                value={metric.progress}
                tone="gradient"
                size="sm"
                label={`${metric.label} ilerlemesi`}
              />
            ) : metric.footnote ? (
              <>
                {metric.footnoteIcon ? <Icon name={metric.footnoteIcon} size="sm" /> : null}
                <Text role="body-sm" tone="muted">
                  {metric.footnote}
                </Text>
              </>
            ) : null
          }
        />
      ))}
    </div>
  );
}

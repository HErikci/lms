import { Card, Icon, Text } from '../components';
import { PageContainer } from '../layout/PageContainer';
import styles from './PlaceholderPage.module.css';

interface PlaceholderPageProps {
  title: string;
  icon: string;
  /** Bu bölüm açıldığında kullanıcının yapabileceği şey. */
  promise: string;
}

/** Henüz uygulanmamış menü hedefleri için ortak iskelet sayfa. */
export function PlaceholderPage({ title, icon, promise }: PlaceholderPageProps) {
  return (
    <PageContainer>
      <Card padding="lg" className={styles.card}>
        <span className={styles.iconTile}>
          <Icon name={icon} size="xl" />
        </span>

        <div className={styles.text}>
          <Text role="headline-md" as="h1" tone="navy" weight="bold">
            {title}
          </Text>
          <Text role="body-lg" as="p" tone="muted">
            {promise}
          </Text>
        </div>
      </Card>
    </PageContainer>
  );
}

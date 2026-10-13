import { Button, Icon, Text } from '../../../components';
import type { AiGuide } from '../../../types';
import styles from './AiGuideCard.module.css';

interface AiGuideCardProps {
  guide: AiGuide;
}

/**
 * Yapay zekâ rehberi kartı. FR-57 gereği yanıtların yapay zekâ üretimi olduğu
 * açıkça belirtilir; zemin rengi ai-assistant-tint ile diğer kartlardan ayrışır.
 */
export function AiGuideCard({ guide }: AiGuideCardProps) {
  // Vurgulanacak ifade mesajın içinde geçmiyorsa metin olduğu gibi gösterilir.
  const hasHighlight = guide.message.includes(guide.highlight);
  const [before, after] = hasHighlight
    ? guide.message.split(guide.highlight)
    : [guide.message, ''];

  return (
    <section className={styles.card} aria-labelledby="ai-guide-title">
      <header className={styles.header}>
        <span className={styles.iconTile}>
          <Icon name="auto_awesome" size="lg" filled />
        </span>
        <span className={styles.titles}>
          <Text role="headline-sm" as="h2" tone="navy" weight="bold">
            <span id="ai-guide-title">{guide.title}</span>
          </Text>
          <Text role="label-md" tone="success">
            {guide.status}
          </Text>
        </span>
      </header>

      <Text role="body-md" as="p" tone="muted">
        {before}
        {hasHighlight ? (
          <em className={styles.highlight}>&lsquo;{guide.highlight}&rsquo;</em>
        ) : null}
        {after}
      </Text>

      <Button variant="navy" iconStart="psychology" fullWidth>
        {guide.ctaLabel}
      </Button>

      <Text role="body-sm" as="p" tone="muted">
        Yanıtlar yapay zekâ tarafından üretilir, hata içerebilir.
      </Text>
    </section>
  );
}

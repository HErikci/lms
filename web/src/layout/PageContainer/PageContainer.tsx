import type { ReactNode } from 'react';
import styles from './PageContainer.module.css';

interface PageContainerProps {
  children: ReactNode;
}

/** Sayfa içeriğini ortalar ve DESIGN.md'deki dış kenar boşluklarını uygular. */
export function PageContainer({ children }: PageContainerProps) {
  return <div className={styles.container}>{children}</div>;
}

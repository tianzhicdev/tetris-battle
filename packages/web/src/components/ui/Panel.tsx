import type { ReactNode } from 'react';
import styles from './Panel.module.css';

interface PanelProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  width?: number;
}

export function Panel({ title, onClose, children, width = 480 }: PanelProps) {
  return (
    <div className={styles.panel} style={{ width }}>
      <div className={styles.header}>
        <div className={styles.title}>{title}</div>
        {onClose && (
          <button onClick={onClose} className={styles.closeButton}>
            ✕
          </button>
        )}
      </div>
      <div className={styles.divider} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}

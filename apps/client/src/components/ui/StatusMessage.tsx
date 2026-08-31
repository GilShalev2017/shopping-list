import type { ReactNode } from 'react';
import styles from './StatusMessage.module.css';

export interface StatusMessageProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: 'neutral' | 'error';
}

export const StatusMessage = ({
  icon = '📦',
  title,
  description,
  action,
  tone = 'neutral',
}: StatusMessageProps) => (
  <div
    className={[styles.status, tone === 'error' ? styles.error : undefined]
      .filter(Boolean)
      .join(' ')}
    role={tone === 'error' ? 'alert' : 'status'}
  >
    <span className={styles.icon} aria-hidden="true">
      {icon}
    </span>
    <p className={styles.title}>{title}</p>
    {description ? <p className={styles.description}>{description}</p> : null}
    {action ? <div className={styles.actions}>{action}</div> : null}
  </div>
);

export interface SkeletonListProps {
  rows?: number;
  label: string;
}

export const SkeletonList = ({ rows = 4, label }: SkeletonListProps) => (
  <div className={styles.skeletonList} role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">{label}</span>
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className={styles.skeleton} aria-hidden="true" />
    ))}
  </div>
);

export default StatusMessage;

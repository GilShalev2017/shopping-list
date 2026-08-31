import type { ReactNode } from 'react';
import styles from './Card.module.css';

export interface CardProps {
  title?: ReactNode;
  /** Rendered at the far inline-end of the header (counts, actions). */
  action?: ReactNode;
  children: ReactNode;
  /** Removes body padding for edge-to-edge lists. */
  flush?: boolean;
  className?: string;
  as?: 'section' | 'aside' | 'div';
  'aria-labelledby'?: string;
}

export const Card = ({
  title,
  action,
  children,
  flush = false,
  className,
  as: Tag = 'section',
  ...rest
}: CardProps) => (
  <Tag className={[styles.card, className].filter(Boolean).join(' ')} {...rest}>
    {title ? (
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {action ? <div className={styles.subtitle}>{action}</div> : null}
      </header>
    ) : null}
    <div className={flush ? styles.bodyFlush : styles.body}>{children}</div>
  </Tag>
);

export default Card;

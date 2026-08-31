import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretches the button to the width of its container. */
  block?: boolean;
  /** Renders a square icon button; pass an accessible name via aria-label. */
  iconOnly?: boolean;
  /** Shows a spinner and disables interaction. */
  loading?: boolean;
  children?: ReactNode;
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  block = false,
  iconOnly = false,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) => {
  const classes = [
    styles.button,
    styles[variant],
    size !== 'md' ? styles[size] : undefined,
    block ? styles.block : undefined,
    iconOnly ? styles.icon : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {children}
    </button>
  );
};

export default Button;

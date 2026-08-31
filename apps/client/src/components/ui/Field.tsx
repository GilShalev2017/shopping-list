import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import styles from './Field.module.css';

interface BaseFieldProps {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean;
  requiredLabel?: string;
}

const FieldShell = ({
  label,
  error,
  hint,
  required,
  requiredLabel,
  controlId,
  errorId,
  hintId,
  children,
}: BaseFieldProps & {
  controlId: string;
  errorId: string;
  hintId: string;
  children: ReactNode;
}) => (
  <div className={styles.field}>
    <div className={styles.labelRow}>
      <label className={styles.label} htmlFor={controlId}>
        {label}
      </label>
      {required && requiredLabel ? (
        <span className={styles.required} aria-hidden="true">
          {requiredLabel}
        </span>
      ) : null}
    </div>

    {children}

    {hint && !error ? (
      <span id={hintId} className={styles.hint}>
        {hint}
      </span>
    ) : null}

    {error ? (
      <span id={errorId} className={styles.error} role="alert">
        <span aria-hidden="true">⚠</span>
        {error}
      </span>
    ) : null}
  </div>
);

/* ------------------------------------------------------------------ */

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>,
    BaseFieldProps {}

export const TextField = ({
  label,
  error,
  hint,
  required,
  requiredLabel,
  className,
  ...rest
}: TextFieldProps) => {
  const id = useId();
  const controlId = `${id}-control`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <FieldShell
      label={label}
      error={error}
      hint={hint}
      required={required}
      requiredLabel={requiredLabel}
      controlId={controlId}
      errorId={errorId}
      hintId={hintId}
    >
      <input
        id={controlId}
        className={[styles.control, error ? styles.invalid : undefined, className]
          .filter(Boolean)
          .join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        aria-required={required || undefined}
        {...rest}
      />
    </FieldShell>
  );
};

/* ------------------------------------------------------------------ */

export interface SelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'>,
    BaseFieldProps {
  children: ReactNode;
}

export const SelectField = ({
  label,
  error,
  hint,
  required,
  requiredLabel,
  className,
  children,
  ...rest
}: SelectFieldProps) => {
  const id = useId();
  const controlId = `${id}-control`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <FieldShell
      label={label}
      error={error}
      hint={hint}
      required={required}
      requiredLabel={requiredLabel}
      controlId={controlId}
      errorId={errorId}
      hintId={hintId}
    >
      <select
        id={controlId}
        className={[
          styles.control,
          styles.select,
          error ? styles.invalid : undefined,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
};

import { useTranslation } from 'react-i18next';
import { MAX_QUANTITY, MIN_QUANTITY } from '@/features/cart/cartSlice';
import styles from './QuantityStepper.module.css';

export interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  /** Accessible name for the numeric input (the visible label lives elsewhere). */
  label: string;
  size?: 'sm' | 'md';
  min?: number;
  max?: number;
  disabled?: boolean;
}

/**
 * Plus / minus / free-typing quantity control. Clamping lives here so every
 * caller — the picker on screen 1 and each cart line — behaves identically.
 */
export const QuantityStepper = ({
  value,
  onChange,
  label,
  size = 'md',
  min = MIN_QUANTITY,
  max = MAX_QUANTITY,
  disabled = false,
}: QuantityStepperProps) => {
  const { t } = useTranslation();

  const clamp = (next: number) => Math.min(max, Math.max(min, next));

  return (
    <div
      className={[styles.stepper, size === 'sm' ? styles.sm : undefined]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className={styles.button}
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label={t('picker.decrease')}
      >
        −
      </button>

      <input
        type="number"
        className={styles.input}
        value={value}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        aria-label={label}
        // Selecting on focus lets a typed digit replace the value instead of
        // being appended to it, which is what people expect from a tiny numeric
        // field. Clearing it is otherwise impossible in a controlled input.
        onFocus={(event) => event.target.select()}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          if (Number.isNaN(parsed)) return;
          onChange(clamp(parsed));
        }}
      />

      <button
        type="button"
        className={styles.button}
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label={t('picker.increase')}
      >
        +
      </button>
    </div>
  );
};

export default QuantityStepper;

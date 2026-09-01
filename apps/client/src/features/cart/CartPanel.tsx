import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { Tooltip } from '@/components/ui/Tooltip';
import { useIsTruncated } from '@/lib/useIsTruncated';
import { formatCurrency, localizedName } from '@/lib/format';
import {
  cartCleared,
  highlightCleared,
  itemRemoved,
  quantityChanged,
  selectCartItemCount,
  selectCartItems,
  selectCartLineCount,
  selectCartTotal,
  selectLastAddedId,
  type CartItem,
} from './cartSlice';
import styles from './CartPanel.module.css';

const HIGHLIGHT_MS = 900;

interface CartLineProps {
  item: CartItem;
  highlighted: boolean;
}

/**
 * One cart row. Split into its own component so each row can own the
 * truncation measurement for its product name.
 */
const CartLine = ({ item, highlighted }: CartLineProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const locale = useAppSelector((state) => state.ui.locale);

  const name = localizedName(item, locale);
  // The panel is narrow, so long names are clipped with an ellipsis. Offer the
  // full name on hover — but only when it is genuinely cut off, otherwise the
  // tooltip is noise that repeats what is already on screen.
  const [nameRef, isNameTruncated] = useIsTruncated<HTMLSpanElement>(name);

  return (
    <li
      className={[styles.line, highlighted ? styles.lineHighlight : undefined]
        .filter(Boolean)
        .join(' ')}
      data-testid={`cart-line-${item.productId}`}
    >
      <Tooltip
        label={name}
        enabled={isNameTruncated}
        className={styles.lineMain}
        data-testid={`cart-line-label-${item.productId}`}
      >
        <span className={styles.lineEmoji} aria-hidden="true">
          {item.emoji}
        </span>

        <span className={styles.lineText}>
          <span ref={nameRef} className={styles.lineName}>
            {name}
          </span>
          <span className={`${styles.lineMeta} numeric`}>
            {formatCurrency(item.unitPrice, locale)} ·{' '}
            {t('products.perUnit', { unit: t(`unit.${item.unit}`) })}
          </span>
        </span>
      </Tooltip>

      <span className={styles.lineActions}>
        <QuantityStepper
          size="sm"
          value={item.quantity}
          label={t('cart.quantityFor', { product: name })}
          onChange={(quantity) =>
            dispatch(quantityChanged({ productId: item.productId, quantity }))
          }
        />
        <span
          className={`${styles.lineTotal} numeric`}
          data-testid={`cart-line-total-${item.productId}`}
        >
          {formatCurrency(item.quantity * item.unitPrice, locale)}
        </span>
        <button
          type="button"
          className={styles.remove}
          onClick={() => dispatch(itemRemoved(item.productId))}
          aria-label={t('cart.remove', { product: name })}
          data-testid={`cart-remove-${item.productId}`}
        >
          ✕
        </button>
      </span>
    </li>
  );
};

/**
 * Screen 1, requirement 3: the cart is rendered on-screen as products are added.
 * Quantities stay editable here so a mistake does not force a remove-and-re-add.
 */
export const CartPanel = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const locale = useAppSelector((state) => state.ui.locale);
  const items = useAppSelector(selectCartItems);
  const total = useAppSelector(selectCartTotal);
  const itemCount = useAppSelector(selectCartItemCount);
  const lineCount = useAppSelector(selectCartLineCount);
  const lastAddedId = useAppSelector(selectLastAddedId);

  // Clear the "just added" flash so it can retrigger on the next add.
  useEffect(() => {
    if (lastAddedId === null) return;
    const timer = window.setTimeout(() => dispatch(highlightCleared()), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [lastAddedId, dispatch]);

  const isEmpty = items.length === 0;

  return (
    <Card
      as="aside"
      className={styles.panel}
      flush
      title={
        <>
          <span aria-hidden="true">🧺</span>
          {t('cart.heading')}
        </>
      }
      action={isEmpty ? undefined : t('cart.lines', { count: lineCount })}
    >
      {/* Announces additions to screen-reader users without stealing focus. */}
      <span className="sr-only" role="status" aria-live="polite">
        {t('cart.items', { count: itemCount })}
      </span>

      {isEmpty ? (
        <StatusMessage icon="🛒" title={t('cart.empty')} description={t('cart.emptyHint')} />
      ) : (
        <>
          <ul className={styles.list} data-testid="cart-list">
            {items.map((item) => (
              <CartLine
                key={item.productId}
                item={item}
                highlighted={item.productId === lastAddedId}
              />
            ))}
          </ul>

          <div className={styles.summary}>
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>
                {t('cart.total')} · {t('cart.items', { count: itemCount })}
              </span>
              <span className={`${styles.totalValue} numeric`} data-testid="cart-total">
                {formatCurrency(total, locale)}
              </span>
            </div>

            <div className={styles.footerActions}>
              <Button
                size="lg"
                block
                onClick={() => navigate('/checkout')}
                data-testid="continue-to-order"
              >
                {t('cart.continue')}
                <span aria-hidden="true">→</span>
              </Button>
              <Button
                variant="danger"
                size="sm"
                block
                onClick={() => dispatch(cartCleared())}
                data-testid="clear-cart"
              >
                {t('cart.clear')}
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};

export default CartPanel;

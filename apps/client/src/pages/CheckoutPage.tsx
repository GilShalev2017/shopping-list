import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { StatusMessage } from '@/components/ui/StatusMessage';
import {
  cartCleared,
  selectCartItemCount,
  selectCartItems,
  selectCartTotal,
  selectOrderItems,
} from '@/features/cart/cartSlice';
import { ORDERS_BASE_URL, useCreateOrderMutation } from '@/features/orders/ordersApi';
import {
  normalizeCustomer,
  validateCustomer,
  type CustomerErrors,
} from '@/features/orders/validation';
import { formatCurrency, localizedName } from '@/lib/format';
import type { OrderCustomer } from '@/types/orders';
import styles from './CheckoutPage.module.css';

const EMPTY_CUSTOMER: OrderCustomer = { fullName: '', address: '', email: '' };

/**
 * Screen 2 — the order summary form.
 *
 * Requirement 1: three required fields. Requirement 2: the products chosen on
 * screen 1 are listed. Requirements 3 and 4: "confirm order" POSTs the form and
 * the item array to the NestJS service, which persists both.
 */
export const CheckoutPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const locale = useAppSelector((state) => state.ui.locale);
  const items = useAppSelector(selectCartItems);
  const orderItems = useAppSelector(selectOrderItems);
  const total = useAppSelector(selectCartTotal);
  const itemCount = useAppSelector(selectCartItemCount);

  const [customer, setCustomer] = useState<OrderCustomer>(EMPTY_CUSTOMER);
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const [createOrder, { isLoading, isError }] = useCreateOrderMutation();

  const setField = (field: keyof OrderCustomer) => (value: string) => {
    const next = { ...customer, [field]: value };
    setCustomer(next);
    // Only re-validate live once the user has attempted a submit, so the form
    // does not shout at someone who is still typing their first field.
    if (submitted) setErrors(validateCustomer(next));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);

    const nextErrors = validateCustomer(customer);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (orderItems.length === 0) return;

    try {
      const order = await createOrder({
        customer: normalizeCustomer(customer),
        items: orderItems,
        locale,
      }).unwrap();

      dispatch(cartCleared());
      navigate(`/orders/${order.id}`, { state: { order } });
    } catch {
      // The error banner is driven by RTK Query's `isError`; nothing to do here
      // beyond keeping the cart intact so the user can retry.
    }
  };

  if (items.length === 0) {
    return (
      <Card>
        <StatusMessage
          icon="🧺"
          title={t('checkout.emptyCart')}
          description={t('checkout.emptyCartHint')}
          action={
            <Button onClick={() => navigate('/')}>{t('checkout.goShopping')}</Button>
          }
        />
      </Card>
    );
  }

  const errorCount = Object.keys(errors).length;

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <Link to="/" className={styles.back}>
          <span className={styles.backArrow} aria-hidden="true">
            ←
          </span>
          {t('nav.backToShopping')}
        </Link>
        <h1 className={styles.heroTitle}>{t('checkout.heading')}</h1>
        <p className={styles.heroText}>{t('checkout.subheading')}</p>
      </div>

      <Card
        title={
          <>
            <span aria-hidden="true">📝</span>
            {t('checkout.detailsHeading')}
          </>
        }
      >
        <form className={styles.form} onSubmit={handleSubmit} noValidate data-testid="order-form">
          {submitted && errorCount > 0 ? (
            <p className={styles.errorBanner} role="alert" data-testid="validation-summary">
              <span aria-hidden="true">⚠</span>
              {t('validation.summary', { count: errorCount })}
            </p>
          ) : null}

          {isError ? (
            <p className={styles.errorBanner} role="alert" data-testid="submit-error">
              <span aria-hidden="true">⚠</span>
              {t('status.orderError')} {t('status.orderErrorHint', { url: ORDERS_BASE_URL })}
            </p>
          ) : null}

          <TextField
            label={t('checkout.fullName')}
            placeholder={t('checkout.fullNamePlaceholder')}
            value={customer.fullName}
            onChange={(event) => setField('fullName')(event.target.value)}
            error={errors.fullName ? t(errors.fullName) : undefined}
            required
            requiredLabel={t('checkout.required')}
            autoComplete="name"
            maxLength={120}
            data-testid="input-fullName"
          />

          <TextField
            label={t('checkout.address')}
            placeholder={t('checkout.addressPlaceholder')}
            value={customer.address}
            onChange={(event) => setField('address')(event.target.value)}
            error={errors.address ? t(errors.address) : undefined}
            required
            requiredLabel={t('checkout.required')}
            autoComplete="street-address"
            maxLength={250}
            data-testid="input-address"
          />

          <TextField
            label={t('checkout.email')}
            placeholder={t('checkout.emailPlaceholder')}
            type="email"
            value={customer.email}
            onChange={(event) => setField('email')(event.target.value)}
            error={errors.email ? t(errors.email) : undefined}
            required
            requiredLabel={t('checkout.required')}
            autoComplete="email"
            maxLength={200}
            dir="ltr"
            data-testid="input-email"
          />

          <div className={styles.submitRow}>
            <span className={`${styles.heroText} numeric`}>
              {t('cart.items', { count: itemCount })} · {formatCurrency(total, locale)}
            </span>
            <Button type="submit" size="lg" loading={isLoading} data-testid="submit-order">
              {isLoading ? t('checkout.submitting') : t('checkout.submit')}
            </Button>
          </div>
        </form>
      </Card>

      <Card
        as="aside"
        flush
        title={
          <>
            <span aria-hidden="true">🧺</span>
            {t('checkout.itemsHeading')}
          </>
        }
        action={t('cart.lines', { count: items.length })}
      >
        <ul className={styles.summaryList} data-testid="checkout-items">
          {items.map((item) => (
            <li key={item.productId} className={styles.summaryLine}>
              <span className={styles.summaryEmoji} aria-hidden="true">
                {item.emoji}
              </span>
              <span className={styles.summaryText}>
                <span className={styles.summaryName}>{localizedName(item, locale)}</span>
                <span className={`${styles.summaryMeta} numeric`}>
                  {item.quantity} × {formatCurrency(item.unitPrice, locale)}
                </span>
              </span>
              <span className={`${styles.summaryTotal} numeric`}>
                {formatCurrency(item.quantity * item.unitPrice, locale)}
              </span>
            </li>
          ))}
        </ul>

        <div className={styles.totals}>
          <span className={styles.totalsLabel}>{t('cart.total')}</span>
          <span className={`${styles.totalsValue} numeric`} data-testid="checkout-total">
            {formatCurrency(total, locale)}
          </span>
        </div>
      </Card>
    </div>
  );
};

export default CheckoutPage;

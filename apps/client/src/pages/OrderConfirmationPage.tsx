import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/app/hooks';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SkeletonList, StatusMessage } from '@/components/ui/StatusMessage';
import { useGetOrderQuery } from '@/features/orders/ordersApi';
import { formatCurrency, formatDateTime, localizedName } from '@/lib/format';
import type { Order } from '@/types/orders';
import styles from './OrderConfirmationPage.module.css';

/**
 * Post-submit receipt. The order is handed over in router state after a
 * successful POST (so the happy path renders instantly), and re-fetched from the
 * orders service by id when the page is opened cold — which also proves the
 * order really was persisted in the NoSQL store.
 */
export const OrderConfirmationPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { orderId = '' } = useParams<{ orderId: string }>();
  const location = useLocation();
  const locale = useAppSelector((state) => state.ui.locale);

  const handedOver = (location.state as { order?: Order } | null)?.order;

  const { data, isLoading, isError } = useGetOrderQuery(orderId, {
    skip: !orderId || Boolean(handedOver),
  });

  const order = handedOver ?? data;

  if (!order && isLoading) {
    return (
      <Card>
        <SkeletonList rows={3} label={t('confirmation.loading')} />
      </Card>
    );
  }

  if (!order) {
    return (
      <Card>
        <StatusMessage
          tone="error"
          icon="🔎"
          title={t('confirmation.notFound')}
          description={isError ? t('confirmation.notFoundHint') : undefined}
          action={<Button onClick={() => navigate('/')}>{t('checkout.goShopping')}</Button>}
        />
      </Card>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <span className={styles.check} aria-hidden="true">
          ✓
        </span>
        <h1 className={styles.title}>{t('confirmation.heading')}</h1>
        <p className={styles.thanks}>
          {t('confirmation.thanks', { name: order.customer.fullName })}
        </p>
        <p className={styles.thanks}>
          {t('confirmation.sentTo', { email: order.customer.email })}
        </p>
        <span className={styles.reference} data-testid="order-reference">
          <span className={styles.referenceLabel}>{t('confirmation.reference')}</span>
          {order.reference}
        </span>
      </div>

      <Card>
        <div className={styles.details}>
          <div className={styles.detail}>
            <span className={styles.detailLabel}>{t('confirmation.deliverTo')}</span>
            <span className={styles.detailValue}>{order.customer.address}</span>
          </div>
          <div className={styles.detail}>
            <span className={styles.detailLabel}>{t('confirmation.placedAt')}</span>
            <span className={styles.detailValue}>{formatDateTime(order.createdAt, locale)}</span>
          </div>
        </div>
      </Card>

      <Card
        flush
        title={
          <>
            <span aria-hidden="true">📦</span>
            {t('confirmation.itemsHeading')}
          </>
        }
        action={t('cart.items', { count: order.itemCount })}
      >
        <ul className={styles.itemList} data-testid="confirmation-items">
          {order.items.map((item) => (
            <li key={item.productId} className={styles.item}>
              <span>
                <span className={styles.itemName}>{localizedName(item, locale)}</span>
                <br />
                <span className={`${styles.itemMeta} numeric`}>
                  {item.quantity} × {formatCurrency(item.unitPrice, locale)}
                </span>
              </span>
              <span className={`${styles.itemTotal} numeric`}>
                {formatCurrency(item.lineTotal, locale)}
              </span>
            </li>
          ))}
        </ul>

        <div className={styles.grandTotal}>
          <span>{t('cart.total')}</span>
          <span className={`${styles.grandTotalValue} numeric`} data-testid="confirmation-total">
            {formatCurrency(order.totalAmount, locale)}
          </span>
        </div>
      </Card>

      <div className={styles.actions}>
        <Button variant="secondary" size="lg" onClick={() => navigate('/')}>
          {t('confirmation.newOrder')}
        </Button>
      </div>
    </div>
  );
};

export default OrderConfirmationPage;

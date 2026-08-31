import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/app/hooks';
import { selectCartItemCount } from '@/features/cart/cartSlice';
import { AppearanceControls } from '@/features/ui/AppearanceControls';
import styles from './AppLayout.module.css';

export interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { t } = useTranslation();
  const itemCount = useAppSelector(selectCartItemCount);

  return (
    <>
      <a className="skip-link" href="#main">
        {t('app.skipToContent')}
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand}>
            <span className={styles.mark} aria-hidden="true">
              🛒
            </span>
            <span className={styles.brandText}>
              <span className={styles.brandTitle}>{t('app.title')}</span>
              <span className={styles.brandTagline}>{t('app.tagline')}</span>
            </span>
          </Link>

          <div className={styles.headerActions}>
            <Link to="/checkout" className={styles.cartPill} data-testid="header-cart">
              <span aria-hidden="true">🧺</span>
              <span>{t('cart.heading')}</span>
              <span className={styles.cartCount} data-testid="header-cart-count">
                {itemCount}
              </span>
              <span className="sr-only">{t('cart.items', { count: itemCount })}</span>
            </Link>
            <AppearanceControls />
          </div>
        </div>
      </header>

      <main id="main" className={styles.main}>
        {children}
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>{t('footer.screens')}</span>
          <span>{t('footer.builtWith')}</span>
        </div>
      </footer>
    </>
  );
};

export default AppLayout;

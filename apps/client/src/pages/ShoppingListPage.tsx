import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SkeletonList, StatusMessage } from '@/components/ui/StatusMessage';
import { CATALOG_BASE_URL, useGetCategoriesQuery } from '@/features/catalog/catalogApi';
import { ProductPicker } from '@/features/catalog/ProductPicker';
import { ProductGrid } from '@/features/catalog/ProductGrid';
import { CartPanel } from '@/features/cart/CartPanel';
import { useAppSelector } from '@/app/hooks';
import { localizedName } from '@/lib/format';
import styles from './ShoppingListPage.module.css';

/**
 * Screen 1 — the shopping list.
 *
 * Requirement 1 is satisfied by the single `useGetCategoriesQuery()` below:
 * categories *and* their products arrive in one request when the page mounts.
 */
export const ShoppingListPage = () => {
  const { t } = useTranslation();
  const locale = useAppSelector((state) => state.ui.locale);
  const { data: categories, isLoading, isError, refetch } = useGetCategoriesQuery();

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  // Preselect the first category once the catalog lands, so the shelf below is
  // never empty on arrival.
  useEffect(() => {
    if (selectedCategoryId !== null) return;
    const first = categories?.[0];
    if (first) setSelectedCategoryId(first.id);
  }, [categories, selectedCategoryId]);

  const selectedCategory =
    categories?.find((category) => category.id === selectedCategoryId) ?? null;

  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>{t('nav.shopping')}</h1>
          <p className={styles.heroText}>{t('app.tagline')}</p>
        </div>

        <Card
          title={
            <>
              <span aria-hidden="true">🧾</span>
              {t('picker.heading')}
            </>
          }
        >
          {isLoading ? (
            <SkeletonList rows={2} label={t('status.loadingCatalog')} />
          ) : isError || !categories ? (
            <StatusMessage
              tone="error"
              icon="🔌"
              title={t('status.catalogError')}
              description={t('status.catalogErrorHint', { url: CATALOG_BASE_URL })}
              action={
                <Button variant="secondary" onClick={() => void refetch()}>
                  {t('status.retry')}
                </Button>
              }
            />
          ) : (
            <ProductPicker
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onCategoryChange={setSelectedCategoryId}
            />
          )}
        </Card>

        {!isLoading && !isError && categories ? (
          <Card
            title={
              <>
                <span aria-hidden="true">🛍️</span>
                {selectedCategory
                  ? t('products.heading', { category: localizedName(selectedCategory, locale) })
                  : t('products.headingAll')}
              </>
            }
            action={t('products.browseHint')}
          >
            <ProductGrid
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onCategoryChange={setSelectedCategoryId}
            />
          </Card>
        ) : null}
      </div>

      <CartPanel />
    </div>
  );
};

export default ShoppingListPage;

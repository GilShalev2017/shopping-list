import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { itemAdded, selectCartState } from '@/features/cart/cartSlice';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { formatCurrency, localizedName } from '@/lib/format';
import type { Category } from '@/types/catalog';
import styles from './ProductGrid.module.css';

export interface ProductGridProps {
  categories: Category[];
  selectedCategoryId: number | null;
  onCategoryChange: (categoryId: number | null) => void;
}

/**
 * A visual "shelf" that complements the dropdown flow above it. Both write to
 * the same cart slice, so either route satisfies screen 1's requirements; this
 * one just makes the app pleasant to actually use.
 */
export const ProductGrid = ({
  categories,
  selectedCategoryId,
  onCategoryChange,
}: ProductGridProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const locale = useAppSelector((state) => state.ui.locale);
  const cart = useAppSelector(selectCartState);

  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? null;
  const products = selectedCategory?.products ?? [];

  return (
    <div>
      <div className={styles.chips} role="group" aria-label={t('picker.category')}>
        {categories.map((category) => {
          const active = category.id === selectedCategoryId;
          return (
            <button
              key={category.id}
              type="button"
              className={[styles.chip, active ? styles.chipActive : undefined]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={active}
              onClick={() => onCategoryChange(active ? null : category.id)}
              data-testid={`category-chip-${category.id}`}
            >
              {localizedName(category, locale)}
              <span className={styles.chipCount}>{category.products.length}</span>
            </button>
          );
        })}
      </div>

      {!selectedCategory ? (
        <StatusMessage
          icon="🧭"
          title={t('products.empty')}
          description={t('products.emptyHint')}
        />
      ) : products.length === 0 ? (
        <StatusMessage icon="🗒️" title={t('picker.noProducts')} />
      ) : (
        <ul className={styles.grid} data-testid="product-grid">
          {products.map((product) => {
            const name = localizedName(product, locale);
            const inCart = cart.items[product.id]?.quantity ?? 0;

            return (
              <li key={product.id}>
                <button
                  type="button"
                  className={styles.tile}
                  onClick={() => dispatch(itemAdded(product, 1))}
                  aria-label={t('products.quickAdd', { product: name })}
                  data-testid={`product-tile-${product.id}`}
                >
                  {inCart > 0 ? (
                    <span className={styles.tileBadge} data-testid={`tile-badge-${product.id}`}>
                      {inCart}
                    </span>
                  ) : null}

                  <span className={styles.tileEmoji} aria-hidden="true">
                    {product.emoji}
                  </span>
                  <span className={styles.tileName}>{name}</span>

                  <span className={styles.tileMeta}>
                    <span className={styles.tileUnit}>
                      {t('products.perUnit', { unit: t(`unit.${product.unit}`) })}
                    </span>
                    <span className={`${styles.tilePrice} numeric`}>
                      {formatCurrency(product.pricePerUnit, locale)}
                    </span>
                  </span>

                  <span className={styles.tileAdd} aria-hidden="true">
                    ＋
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ProductGrid;

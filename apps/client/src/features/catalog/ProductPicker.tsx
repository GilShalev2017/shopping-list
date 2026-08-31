import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { itemAdded, selectCartState } from '@/features/cart/cartSlice';
import { SelectField } from '@/components/ui/Field';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { Button } from '@/components/ui/Button';
import { formatCurrency, localizedName } from '@/lib/format';
import type { Category, Product } from '@/types/catalog';
import styles from './ProductPicker.module.css';

export interface ProductPickerProps {
  categories: Category[];
  /** Lifted so the product grid below can mirror the chosen category. */
  selectedCategoryId: number | null;
  onCategoryChange: (categoryId: number | null) => void;
}

/**
 * Screen 1, requirement 2: choose a category, then a product inside it, then a
 * quantity. Requirement 3: "add to cart" puts it in the cart.
 *
 * The product select is intentionally disabled until a category is picked —
 * that dependency is the requirement, and disabling communicates it without an
 * error state.
 */
export const ProductPicker = ({
  categories,
  selectedCategoryId,
  onCategoryChange,
}: ProductPickerProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const locale = useAppSelector((state) => state.ui.locale);
  const cart = useAppSelector(selectCartState);

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  // Memoised so the empty-array fallback does not create a new reference on
  // every render and invalidate the selectedProduct memo below.
  const products = useMemo(() => selectedCategory?.products ?? [], [selectedCategory]);

  const selectedProduct: Product | null = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const quantityInCart = selectedProduct ? (cart.items[selectedProduct.id]?.quantity ?? 0) : 0;

  const handleCategoryChange = (value: string) => {
    const nextId = value === '' ? null : Number(value);
    onCategoryChange(nextId);
    // Changing category invalidates the product selection.
    setSelectedProductId(null);
    setQuantity(1);
  };

  const handleAdd = () => {
    if (!selectedProduct) return;
    dispatch(itemAdded(selectedProduct, quantity));
    setQuantity(1);
  };

  return (
    <div className={styles.picker}>
      <SelectField
        label={t('picker.category')}
        value={selectedCategoryId ?? ''}
        onChange={(event) => handleCategoryChange(event.target.value)}
        data-testid="category-select"
      >
        <option value="">{t('picker.categoryPlaceholder')}</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {localizedName(category, locale)}
          </option>
        ))}
      </SelectField>

      <SelectField
        label={t('picker.product')}
        value={selectedProductId ?? ''}
        disabled={!selectedCategory}
        hint={!selectedCategory ? t('picker.productDisabledHint') : undefined}
        onChange={(event) =>
          setSelectedProductId(event.target.value === '' ? null : Number(event.target.value))
        }
        data-testid="product-select"
      >
        <option value="">
          {products.length === 0 && selectedCategory
            ? t('picker.noProducts')
            : t('picker.productPlaceholder')}
        </option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.emoji} {localizedName(product, locale)}
          </option>
        ))}
      </SelectField>

      <div className={styles.quantityBlock}>
        <span className={styles.quantityLabel} id="picker-quantity-label">
          {t('picker.quantity')}
        </span>
        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          label={t('picker.quantity')}
          disabled={!selectedProduct}
        />
      </div>

      <div className={styles.addBlock}>
        <Button
          size="lg"
          onClick={handleAdd}
          disabled={!selectedProduct}
          aria-label={
            selectedProduct
              ? t('picker.addAria', { product: localizedName(selectedProduct, locale) })
              : t('picker.add')
          }
          data-testid="add-to-cart"
        >
          <span aria-hidden="true">＋</span>
          {t('picker.add')}
        </Button>
      </div>

      {selectedProduct ? (
        <div className={styles.preview} data-testid="picker-preview">
          <span className={styles.previewEmoji} aria-hidden="true">
            {selectedProduct.emoji}
          </span>
          <span className={styles.previewText}>
            <span className={styles.previewName}>
              {localizedName(selectedProduct, locale)}
            </span>
            <span className={styles.previewMeta}>
              {t('products.perUnit', { unit: t(`unit.${selectedProduct.unit}`) })}
              {quantityInCart > 0 ? (
                <>
                  {' · '}
                  <span className={styles.inCart}>
                    {t('picker.inCart', { count: quantityInCart })}
                  </span>
                </>
              ) : null}
            </span>
          </span>
          <span className={`${styles.previewPrice} numeric`}>
            {formatCurrency(selectedProduct.pricePerUnit * quantity, locale)}
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default ProductPicker;

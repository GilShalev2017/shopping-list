/**
 * Wire types for the catalog service (.NET 10 + EF Core + SQL Server).
 * These mirror docs/CONTRACT.md section 2 exactly.
 */

export type ProductUnit = 'unit' | 'kg' | 'pack' | 'bottle' | 'carton';

export interface Product {
  id: number;
  categoryId: number;
  slug: string;
  nameEn: string;
  nameHe: string;
  unit: ProductUnit;
  pricePerUnit: number;
  emoji: string;
  isActive: boolean;
}

export interface Category {
  id: number;
  slug: string;
  nameEn: string;
  nameHe: string;
  sortOrder: number;
  products: Product[];
}

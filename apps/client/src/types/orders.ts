/**
 * Wire types for the orders service (NestJS + Elasticsearch / MongoDB).
 * These mirror docs/CONTRACT.md section 3 exactly.
 */

import type { ProductUnit } from './catalog';
import type { Locale } from '@/features/ui/uiSlice';

export interface OrderCustomer {
  fullName: string;
  address: string;
  email: string;
}

export interface OrderItemPayload {
  productId: number;
  categoryId: number;
  nameEn: string;
  nameHe: string;
  unit: ProductUnit;
  quantity: number;
  unitPrice: number;
}

export interface CreateOrderPayload {
  customer: OrderCustomer;
  items: OrderItemPayload[];
  locale: Locale;
}

export interface OrderItem extends OrderItemPayload {
  lineTotal: number;
}

export interface Order {
  id: string;
  reference: string;
  customer: OrderCustomer;
  items: OrderItem[];
  itemCount: number;
  totalAmount: number;
  currency: string;
  locale: Locale;
  status: string;
  createdAt: string;
}

/** Shape NestJS' ValidationPipe returns on a 400. */
export interface ApiValidationError {
  statusCode: number;
  error: string;
  message: string[] | string;
}

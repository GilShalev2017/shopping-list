import { readFileSync } from 'node:fs';

import {
  EMBEDDED_ORDERS_INDEX_DEFINITION,
  OrdersIndexDefinition,
  resolveOrdersMappingPath,
} from './elasticsearch-index.bootstrap';

/**
 * Guards the one duplication in this codebase: the index definition exists both
 * as the graded deliverable `infra/elasticsearch/orders.mapping.json` and as a
 * TypeScript constant used when `infra/` is not mounted. This test is what
 * makes "keep the two in sync" a build failure rather than a code review note.
 */
describe('orders.mapping.json <-> EMBEDDED_ORDERS_INDEX_DEFINITION', () => {
  const path = resolveOrdersMappingPath(__dirname, {});

  it('locates the deliverable mapping file in the monorepo', () => {
    expect(path).not.toBeNull();
  });

  const fromFile = JSON.parse(
    readFileSync(path as string, 'utf8'),
  ) as OrdersIndexDefinition;

  it('is identical to the embedded fallback', () => {
    expect(EMBEDDED_ORDERS_INDEX_DEFINITION).toEqual(fromFile);
  });

  describe('the mapping itself', () => {
    const mappings = fromFile.mappings as Record<string, any>;
    const properties = mappings.properties as Record<string, any>;

    it('is a single-shard, zero-replica index suitable for a local single node', () => {
      const settings = fromFile.settings as Record<string, any>;
      expect(settings.index.number_of_shards).toBe(1);
      expect(settings.index.number_of_replicas).toBe(0);
    });

    it('declares the lowercase normalizer used by customer.email', () => {
      const settings = fromFile.settings as Record<string, any>;
      expect(settings.analysis.normalizer.lowercase_normalizer.filter).toContain(
        'lowercase',
      );
      expect(properties.customer.properties.email).toMatchObject({
        type: 'keyword',
        normalizer: 'lowercase_normalizer',
      });
    });

    it('is strict, so an unexpected field is rejected rather than silently mapped', () => {
      expect(mappings.dynamic).toBe('strict');
      expect(properties.customer.dynamic).toBe('strict');
      expect(properties.items.dynamic).toBe('strict');
    });

    it('carries a _meta block identifying the app and schema version', () => {
      expect(mappings._meta).toMatchObject({
        application: 'orders-api',
        schemaVersion: expect.any(Number),
      });
    });

    it('maps items as nested so per-item queries do not cross-match', () => {
      expect(properties.items.type).toBe('nested');
    });

    it.each([
      ['id', 'keyword'],
      ['reference', 'keyword'],
      ['itemCount', 'integer'],
      ['currency', 'keyword'],
      ['locale', 'keyword'],
      ['status', 'keyword'],
      ['createdAt', 'date'],
    ])('maps %s as %s', (field, type) => {
      expect(properties[field].type).toBe(type);
    });

    it('gives fullName a keyword sub-field for exact match and aggregation', () => {
      expect(properties.customer.properties.fullName).toMatchObject({
        type: 'text',
        fields: { keyword: { type: 'keyword' } },
      });
    });

    it('maps money as scaled_float with a factor of 100 (agorot)', () => {
      expect(properties.totalAmount).toEqual({
        type: 'scaled_float',
        scaling_factor: 100,
      });
      for (const field of ['unitPrice', 'lineTotal']) {
        expect(properties.items.properties[field]).toEqual({
          type: 'scaled_float',
          scaling_factor: 100,
        });
      }
    });

    it('covers exactly the fields OrderMapper.toPersistence emits', () => {
      expect(Object.keys(properties).sort()).toEqual([
        'createdAt',
        'currency',
        'customer',
        'id',
        'itemCount',
        'items',
        'locale',
        'reference',
        'status',
        'totalAmount',
      ]);
      expect(Object.keys(properties.customer.properties).sort()).toEqual([
        'address',
        'email',
        'fullName',
      ]);
      expect(Object.keys(properties.items.properties).sort()).toEqual([
        'categoryId',
        'lineTotal',
        'nameEn',
        'nameHe',
        'productId',
        'quantity',
        'unit',
        'unitPrice',
      ]);
    });
  });
});

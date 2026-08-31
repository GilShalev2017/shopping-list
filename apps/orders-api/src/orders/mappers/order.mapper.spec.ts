import { orderFixture } from '../../__tests__/fixtures';
import { OrderMapper } from './order.mapper';

describe('OrderMapper', () => {
  describe('round trip', () => {
    it('toDomain(toPersistence(order)) === order', () => {
      const order = orderFixture();
      expect(OrderMapper.toDomain(OrderMapper.toPersistence(order))).toEqual(order);
    });

    it('survives a JSON serialisation hop (what the store actually does)', () => {
      const order = orderFixture({
        items: [
          {
            productId: 7,
            categoryId: 2,
            nameEn: 'Bread',
            nameHe: 'לחם',
            unit: 'unit',
            quantity: 3,
            unitPrice: 5.5,
            lineTotal: 16.5,
          },
          {
            productId: 8,
            categoryId: 2,
            nameEn: 'Eggs',
            nameHe: 'ביצים',
            unit: 'pack',
            quantity: 1,
            unitPrice: 14.9,
            lineTotal: 14.9,
          },
        ],
        itemCount: 4,
        totalAmount: 31.4,
        locale: 'en',
      });

      const wire = JSON.parse(
        JSON.stringify(OrderMapper.toPersistence(order)),
      ) as unknown;
      expect(OrderMapper.toDomain(wire)).toEqual(order);
    });

    it('is stable under repeated round trips', () => {
      const order = orderFixture();
      const once = OrderMapper.toDomain(OrderMapper.toPersistence(order));
      const twice = OrderMapper.toDomain(OrderMapper.toPersistence(once));
      expect(twice).toEqual(once);
    });
  });

  describe('toPersistence', () => {
    it('emits exactly the fields the strict Elasticsearch mapping allows', () => {
      const document = OrderMapper.toPersistence(orderFixture());
      expect(Object.keys(document).sort()).toEqual([
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
      expect(Object.keys(document.customer).sort()).toEqual([
        'address',
        'email',
        'fullName',
      ]);
      expect(Object.keys(document.items[0]).sort()).toEqual([
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

    it('drops properties that are not part of the document shape', () => {
      const contaminated = {
        ...orderFixture(),
        internalNote: 'should not be persisted',
      };
      const document = OrderMapper.toPersistence(contaminated);
      expect(document).not.toHaveProperty('internalNote');
    });

    it('re-rounds monetary values on the way out', () => {
      const document = OrderMapper.toPersistence(
        orderFixture({
          totalAmount: 13.800000000000002,
          items: [{ ...orderFixture().items[0], lineTotal: 13.800000000000002 }],
        }),
      );
      expect(document.totalAmount).toBe(13.8);
      expect(document.items[0].lineTotal).toBe(13.8);
    });
  });

  describe('toDomain', () => {
    it('coerces scaled_float values that came back as strings', () => {
      const order = OrderMapper.toDomain({
        ...OrderMapper.toPersistence(orderFixture()),
        totalAmount: '13.80',
        itemCount: '2',
      });
      expect(order.totalAmount).toBe(13.8);
      expect(order.itemCount).toBe(2);
    });

    it.each([null, undefined, {}])('degrades gracefully on %p', (raw) => {
      const order = OrderMapper.toDomain(raw);
      expect(order).toEqual({
        id: '',
        reference: '',
        customer: { fullName: '', address: '', email: '' },
        items: [],
        itemCount: 0,
        totalAmount: 0,
        currency: 'ILS',
        locale: 'he',
        status: 'confirmed',
        createdAt: '',
      });
    });

    it('tolerates a non-array items field', () => {
      expect(OrderMapper.toDomain({ items: 'nope' }).items).toEqual([]);
    });

    it.each([null, undefined, 'garbage'])(
      'normalises the null-ish item %p to a zeroed line',
      (item) => {
        expect(OrderMapper.toDomain({ items: [item] }).items[0]).toEqual({
          productId: 0,
          categoryId: 0,
          nameEn: '',
          nameHe: '',
          unit: '',
          quantity: 0,
          unitPrice: 0,
          lineTotal: 0,
        });
      },
    );

    it('normalises a partially populated item', () => {
      expect(OrderMapper.toDomain({ items: [{ nameEn: 'Milk' }] }).items[0]).toEqual({
        productId: 0,
        categoryId: 0,
        nameEn: 'Milk',
        nameHe: '',
        unit: '',
        quantity: 0,
        unitPrice: 0,
        lineTotal: 0,
      });
    });

    it('truncates non-integer counts rather than propagating them', () => {
      const order = OrderMapper.toDomain({
        itemCount: 2.9,
        items: [{ quantity: 3.7, productId: 1.2 }],
      });
      expect(order.itemCount).toBe(2);
      expect(order.items[0].quantity).toBe(3);
      expect(order.items[0].productId).toBe(1);
    });
  });
});

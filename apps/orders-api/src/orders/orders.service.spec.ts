import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { createOrderDto, orderFixture } from '../__tests__/fixtures';
import { ORDER_REFERENCE_PATTERN, ULID_PATTERN } from '../common/id.util';
import {
  OrderRepository,
  ORDER_REPOSITORY,
} from '../persistence/order-repository.interface';
import { ListOrdersQueryDto } from './dto/list-orders.query.dto';
import { OrderItemDto } from './dto/order-item.dto';
import { OrdersService } from './orders.service';

type MockRepository = {
  [K in keyof OrderRepository]: jest.Mock;
};

const item = (patch: Partial<OrderItemDto> = {}): OrderItemDto =>
  ({
    productId: 101,
    categoryId: 1,
    nameEn: 'Milk 3%',
    nameHe: 'חלב 3%',
    unit: 'carton',
    quantity: 2,
    unitPrice: 6.9,
    ...patch,
  }) as OrderItemDto;

describe('OrdersService', () => {
  let service: OrdersService;
  let repository: MockRepository;

  beforeEach(async () => {
    repository = {
      // save echoes back exactly what it was given, so assertions below are
      // about what the *service* computed, not about adapter behaviour.
      save: jest.fn().mockImplementation((order: unknown) => Promise.resolve(order)),
      findById: jest.fn(),
      list: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: ORDER_REPOSITORY, useValue: repository }],
    }).compile();

    service = moduleRef.get(OrdersService);
  });

  describe('create — server-side totals', () => {
    it('computes lineTotal, itemCount and totalAmount for a single line', async () => {
      const order = await service.create(createOrderDto());

      expect(order.items).toHaveLength(1);
      expect(order.items[0].lineTotal).toBe(13.8);
      expect(order.itemCount).toBe(2);
      expect(order.totalAmount).toBe(13.8);
    });

    it('sums across multiple lines', async () => {
      const order = await service.create(
        createOrderDto({
          items: [
            item({ quantity: 2, unitPrice: 6.9 }), // 13.80
            item({ productId: 102, quantity: 3, unitPrice: 5.5 }), // 16.50
            item({ productId: 103, quantity: 1, unitPrice: 14.9 }), // 14.90
          ],
        }),
      );

      expect(order.items.map((i) => i.lineTotal)).toEqual([13.8, 16.5, 14.9]);
      expect(order.itemCount).toBe(6);
      expect(order.totalAmount).toBe(45.2);
    });

    it.each([
      // [quantity, unitPrice, expected lineTotal]
      [3, 19.9, 59.7], // 3 * 19.9 === 59.699999999999996 in IEEE 754
      [7, 4.15, 29.05], // 29.049999999999997
      [3, 0.1, 0.3], // 0.30000000000000004
      [1, 0.005, 0.01], // rounds half away from zero
      [999, 999.99, 998990.01], // upper bound of the allowed ranges
      [1, 0, 0], // free item
      [11, 1.11, 12.21],
    ])(
      'rounds quantity=%p * unitPrice=%p to %p',
      async (quantity, unitPrice, expected) => {
        const order = await service.create(
          createOrderDto({ items: [item({ quantity, unitPrice })] }),
        );
        expect(order.items[0].lineTotal).toBe(expected);
        expect(order.totalAmount).toBe(expected);
      },
    );

    it('does not let float drift accumulate across 100 lines', async () => {
      const order = await service.create(
        createOrderDto({
          items: Array.from({ length: 100 }, (_unused, index) =>
            item({ productId: index + 1, quantity: 1, unitPrice: 0.1 }),
          ),
        }),
      );
      expect(order.totalAmount).toBe(10);
      expect(order.itemCount).toBe(100);
    });

    it('ignores any client-supplied total and recomputes from quantity * unitPrice', async () => {
      const tampered = createOrderDto({
        items: [item({ quantity: 2, unitPrice: 6.9 })],
      }) as unknown as Record<string, unknown>;
      // Simulates a payload that slipped past the pipe.
      (tampered.items as Record<string, unknown>[])[0].lineTotal = 0.01;
      tampered.totalAmount = 0.01;

      const order = await service.create(tampered as never);
      expect(order.items[0].lineTotal).toBe(13.8);
      expect(order.totalAmount).toBe(13.8);
    });
  });

  describe('create — generated fields', () => {
    it('generates a ULID id and an ORD-XXXXXX reference', async () => {
      const order = await service.create(createOrderDto());
      expect(order.id).toMatch(ULID_PATTERN);
      expect(order.reference).toMatch(ORDER_REFERENCE_PATTERN);
    });

    it('generates a distinct id and reference per order', async () => {
      const [a, b] = await Promise.all([
        service.create(createOrderDto()),
        service.create(createOrderDto()),
      ]);
      expect(a.id).not.toBe(b.id);
      expect(a.reference).not.toBe(b.reference);
    });

    it('stamps status, currency and an ISO-8601 createdAt', async () => {
      const before = Date.now();
      const order = await service.create(createOrderDto());
      const after = Date.now();

      expect(order.status).toBe('confirmed');
      expect(order.currency).toBe('ILS');
      expect(order.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      const created = Date.parse(order.createdAt);
      expect(created).toBeGreaterThanOrEqual(before);
      expect(created).toBeLessThanOrEqual(after);
    });

    it('defaults locale to "he" when omitted', async () => {
      const dto = createOrderDto();
      delete dto.locale;
      await expect(service.create(dto)).resolves.toMatchObject({ locale: 'he' });
    });

    it('honours an explicit locale', async () => {
      await expect(
        service.create(createOrderDto({ locale: 'en' })),
      ).resolves.toMatchObject({ locale: 'en' });
    });

    it('copies only the three contract customer fields', async () => {
      const order = await service.create(createOrderDto());
      expect(Object.keys(order.customer).sort()).toEqual([
        'address',
        'email',
        'fullName',
      ]);
    });
  });

  describe('create — delegation', () => {
    it('hands the fully-computed order to the repository exactly once', async () => {
      const order = await service.create(createOrderDto());

      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: order.id,
          reference: order.reference,
          itemCount: 2,
          totalAmount: 13.8,
          status: 'confirmed',
          currency: 'ILS',
        }),
      );
    });

    it('returns what the repository returned, not the local object', async () => {
      const stored = orderFixture({ reference: 'ORD-STORED'.slice(0, 10) });
      repository.save.mockResolvedValue(stored);
      await expect(service.create(createOrderDto())).resolves.toBe(stored);
    });

    it('propagates a repository failure', async () => {
      repository.save.mockRejectedValue(new Error('store unavailable'));
      await expect(service.create(createOrderDto())).rejects.toThrow('store unavailable');
    });
  });

  describe('findOne', () => {
    it('returns the order from the repository', async () => {
      const order = orderFixture();
      repository.findById.mockResolvedValue(order);

      await expect(service.findOne(order.id)).resolves.toBe(order);
      expect(repository.findById).toHaveBeenCalledWith(order.id);
    });

    it('throws NotFoundException when the repository returns null', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.findOne('missing')).rejects.toThrow(
        'Order missing was not found.',
      );
    });

    it('propagates a repository failure rather than masking it as a 404', async () => {
      repository.findById.mockRejectedValue(new Error('connection refused'));
      await expect(service.findOne('x')).rejects.toThrow('connection refused');
    });
  });

  describe('findAll', () => {
    it('passes limit and offset straight through and returns the envelope', async () => {
      const page = { total: 42, items: [orderFixture()] };
      repository.list.mockResolvedValue(page);

      const query = new ListOrdersQueryDto();
      query.limit = 5;
      query.offset = 40;

      await expect(service.findAll(query)).resolves.toBe(page);
      expect(repository.list).toHaveBeenCalledWith({ limit: 5, offset: 40 });
    });

    it('uses the DTO defaults when nothing was supplied', async () => {
      repository.list.mockResolvedValue({ total: 0, items: [] });
      await service.findAll(new ListOrdersQueryDto());
      expect(repository.list).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    });

    it('does not forward any extra query properties to the adapter', async () => {
      repository.list.mockResolvedValue({ total: 0, items: [] });
      const query = Object.assign(new ListOrdersQueryDto(), { sort: 'asc' });
      await service.findAll(query);
      expect(repository.list.mock.calls[0][0]).toEqual({ limit: 20, offset: 0 });
    });
  });
});

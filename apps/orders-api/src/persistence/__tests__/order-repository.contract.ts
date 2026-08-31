import { orderFixture } from '../../__tests__/fixtures';
import { Order } from '../../orders/entities/order.entity';
import { OrderDocument } from '../../orders/mappers/order.mapper';
import { OrderRepository } from '../order-repository.interface';

/**
 * A driver-agnostic test double: an in-memory "store" plus whatever wiring the
 * concrete adapter needs to read and write it. Each adapter provides one of
 * these; the shared suite below then exercises the adapter through the port.
 */
export interface RepositoryUnderTest {
  readonly repository: OrderRepository;
  /** Documents currently "persisted", in insertion order. */
  readonly documents: OrderDocument[];
  /** Seeds the fake store without going through `save()`. */
  seed(...documents: OrderDocument[]): void;
  /**
   * Asserts driver-specific call details that the port cannot express
   * (e.g. `refresh: 'wait_for'`, the Mongo projection).
   */
  assertSaveSemantics(): void;
  assertListSemantics(params: { limit: number; offset: number }): void;
}

export const CONTRACT_ORDERS: Order[] = [
  orderFixture({
    id: '01J8ZK9X7QF3M2N4P5R6S7T8V1',
    reference: 'ORD-000001',
    createdAt: '2026-08-31T10:00:00.000Z',
  }),
  orderFixture({
    id: '01J8ZK9X7QF3M2N4P5R6S7T8V2',
    reference: 'ORD-000002',
    createdAt: '2026-08-31T11:00:00.000Z',
    locale: 'en',
    items: [
      {
        productId: 205,
        categoryId: 3,
        nameEn: 'Bread',
        nameHe: 'לחם',
        unit: 'unit',
        quantity: 3,
        unitPrice: 5.5,
        lineTotal: 16.5,
      },
    ],
    itemCount: 3,
    totalAmount: 16.5,
  }),
  orderFixture({
    id: '01J8ZK9X7QF3M2N4P5R6S7T8V3',
    reference: 'ORD-000003',
    createdAt: '2026-08-31T12:00:00.000Z',
  }),
];

/**
 * The **shared repository contract**.
 *
 * Every adapter must pass this identical suite. Because both drivers are
 * exercised through the same expectations with the same inputs, a green run is
 * evidence that flipping `NOSQL_DRIVER` cannot change what the API returns —
 * which is the whole promise of the ports-and-adapters design.
 */
export function describeOrderRepositoryContract(
  driverName: string,
  createSubject: () => RepositoryUnderTest,
): void {
  describe(`OrderRepository contract — ${driverName}`, () => {
    let subject: RepositoryUnderTest;

    beforeEach(() => {
      subject = createSubject();
    });

    describe('save', () => {
      it('returns the order unchanged', async () => {
        const order = CONTRACT_ORDERS[0];
        await expect(subject.repository.save(order)).resolves.toEqual(order);
      });

      it('persists exactly the document shape defined by OrderMapper', async () => {
        await subject.repository.save(CONTRACT_ORDERS[0]);

        expect(subject.documents).toHaveLength(1);
        expect(subject.documents[0]).toEqual({
          id: '01J8ZK9X7QF3M2N4P5R6S7T8V1',
          reference: 'ORD-000001',
          customer: {
            fullName: 'ישראל ישראלי',
            address: 'הרצל 10, תל אביב',
            email: 'israel@example.com',
          },
          items: [
            {
              productId: 101,
              categoryId: 1,
              nameEn: 'Milk 3%',
              nameHe: 'חלב 3%',
              unit: 'carton',
              quantity: 2,
              unitPrice: 6.9,
              lineTotal: 13.8,
            },
          ],
          itemCount: 2,
          totalAmount: 13.8,
          currency: 'ILS',
          locale: 'he',
          status: 'confirmed',
          createdAt: '2026-08-31T10:00:00.000Z',
        });
      });

      it('uses the driver-specific write semantics the contract relies on', async () => {
        await subject.repository.save(CONTRACT_ORDERS[0]);
        subject.assertSaveSemantics();
      });

      it('propagates a store failure', async () => {
        subject.seed();
        const failing = subject.repository;
        // Each adapter's fake rejects when asked to store the poison id.
        await expect(
          failing.save({ ...CONTRACT_ORDERS[0], id: '__EXPLODE__' }),
        ).rejects.toThrow('store write failed');
      });
    });

    describe('findById', () => {
      it('returns the stored order', async () => {
        await subject.repository.save(CONTRACT_ORDERS[1]);
        await expect(subject.repository.findById(CONTRACT_ORDERS[1].id)).resolves.toEqual(
          CONTRACT_ORDERS[1],
        );
      });

      it('returns null for an unknown id instead of throwing', async () => {
        await subject.repository.save(CONTRACT_ORDERS[0]);
        await expect(subject.repository.findById('does-not-exist')).resolves.toBeNull();
      });

      it('returns null against an empty store', async () => {
        await expect(subject.repository.findById('anything')).resolves.toBeNull();
      });

      it('propagates a non-404 store failure', async () => {
        await expect(subject.repository.findById('__EXPLODE__')).rejects.toThrow(
          'store read failed',
        );
      });
    });

    describe('list', () => {
      beforeEach(() => {
        // Seeded out of chronological order on purpose.
        subject.seed(
          ...[CONTRACT_ORDERS[1], CONTRACT_ORDERS[0], CONTRACT_ORDERS[2]].map((order) =>
            toDocument(order),
          ),
        );
      });

      it('returns newest first with the full match count', async () => {
        const page = await subject.repository.list({ limit: 20, offset: 0 });

        expect(page.total).toBe(3);
        expect(page.items.map((order) => order.reference)).toEqual([
          'ORD-000003',
          'ORD-000002',
          'ORD-000001',
        ]);
      });

      it('returns fully hydrated domain objects', async () => {
        const page = await subject.repository.list({ limit: 20, offset: 0 });
        expect(page.items[1]).toEqual(CONTRACT_ORDERS[1]);
      });

      it('applies limit', async () => {
        const page = await subject.repository.list({ limit: 2, offset: 0 });
        expect(page.total).toBe(3);
        expect(page.items.map((order) => order.reference)).toEqual([
          'ORD-000003',
          'ORD-000002',
        ]);
      });

      it('applies offset', async () => {
        const page = await subject.repository.list({ limit: 2, offset: 1 });
        expect(page.total).toBe(3);
        expect(page.items.map((order) => order.reference)).toEqual([
          'ORD-000002',
          'ORD-000001',
        ]);
      });

      it('returns an empty page past the end without changing total', async () => {
        const page = await subject.repository.list({ limit: 20, offset: 99 });
        expect(page.total).toBe(3);
        expect(page.items).toEqual([]);
      });

      it('passes pagination to the underlying client', async () => {
        await subject.repository.list({ limit: 7, offset: 14 });
        subject.assertListSemantics({ limit: 7, offset: 14 });
      });
    });

    describe('round trip through the port', () => {
      it('save -> findById -> list all agree', async () => {
        for (const order of CONTRACT_ORDERS) {
          await subject.repository.save(order);
        }

        const fetched = await subject.repository.findById(CONTRACT_ORDERS[2].id);
        const page = await subject.repository.list({ limit: 20, offset: 0 });

        expect(fetched).toEqual(CONTRACT_ORDERS[2]);
        expect(page.items).toEqual([
          CONTRACT_ORDERS[2],
          CONTRACT_ORDERS[1],
          CONTRACT_ORDERS[0],
        ]);
      });
    });
  });
}

function toDocument(order: Order): OrderDocument {
  return JSON.parse(JSON.stringify(order)) as OrderDocument;
}

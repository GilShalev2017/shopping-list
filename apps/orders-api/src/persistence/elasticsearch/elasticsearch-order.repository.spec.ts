import type { Client } from '@elastic/elasticsearch';

import { orderFixture } from '../../__tests__/fixtures';
import { ElasticsearchOrderRepository } from './elasticsearch-order.repository';

const INDEX = 'orders-test';

/**
 * Edge cases that the shared repository contract cannot express because they
 * are specific to how the Elasticsearch response envelope can vary.
 */
describe('ElasticsearchOrderRepository (driver specifics)', () => {
  const repositoryWith = (client: Partial<Client>): ElasticsearchOrderRepository =>
    new ElasticsearchOrderRepository(client as Client, INDEX);

  describe('findById', () => {
    it('returns null when the hit exists but carries no _source', async () => {
      const repository = repositoryWith({
        get: jest.fn().mockResolvedValue({ found: true }),
      } as unknown as Partial<Client>);

      await expect(repository.findById('any')).resolves.toBeNull();
    });

    it('rethrows a transport error that is not a 404', async () => {
      const repository = repositoryWith({
        get: jest.fn().mockRejectedValue(new Error('socket hang up')),
      } as unknown as Partial<Client>);

      await expect(repository.findById('any')).rejects.toThrow('socket hang up');
    });
  });

  describe('list', () => {
    const searchReturning = (hits: unknown): ElasticsearchOrderRepository =>
      repositoryWith({
        search: jest.fn().mockResolvedValue({ hits }),
      } as unknown as Partial<Client>);

    it('reads hits.total when the cluster returns the plain-number form', async () => {
      const page = await searchReturning({ total: 7, hits: [] }).list({
        limit: 10,
        offset: 0,
      });
      expect(page.total).toBe(7);
    });

    it('reads hits.total.value when the cluster returns the object form', async () => {
      const page = await searchReturning({
        total: { value: 9, relation: 'eq' },
        hits: [],
      }).list({ limit: 10, offset: 0 });
      expect(page.total).toBe(9);
    });

    it('falls back to 0 when hits.total is absent altogether', async () => {
      const page = await searchReturning({ hits: [] }).list({ limit: 10, offset: 0 });
      expect(page.total).toBe(0);
    });

    it('skips hits that came back without a _source', async () => {
      const document = JSON.parse(JSON.stringify(orderFixture())) as unknown;
      const page = await searchReturning({
        total: { value: 2 },
        hits: [{ _source: document }, { _id: 'no-source' }],
      }).list({ limit: 10, offset: 0 });

      expect(page.total).toBe(2);
      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toEqual(orderFixture());
    });
  });
});

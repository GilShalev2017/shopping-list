import type { Client } from '@elastic/elasticsearch';

import { OrderDocument } from '../../orders/mappers/order.mapper';
import { ElasticsearchOrderRepository } from '../elasticsearch/elasticsearch-order.repository';
import { MongoOrderRepository } from '../mongodb/mongo-order.repository';
import { OrdersCollection } from '../mongodb/mongo.provider';
import {
  RepositoryUnderTest,
  describeOrderRepositoryContract,
} from './order-repository.contract';

const INDEX = 'orders-test';
/** Id both fakes treat as a poison pill, to exercise the error paths. */
const EXPLODE = '__EXPLODE__';

const clone = (document: OrderDocument): OrderDocument =>
  JSON.parse(JSON.stringify(document)) as OrderDocument;

const newestFirst = (a: OrderDocument, b: OrderDocument): number =>
  b.createdAt.localeCompare(a.createdAt);

// ---------------------------------------------------------------------------
// Elasticsearch: a fake @elastic/elasticsearch v8 Client over an array.
// ---------------------------------------------------------------------------
function createElasticsearchSubject(): RepositoryUnderTest {
  const documents: OrderDocument[] = [];

  const index = jest.fn(
    async ({ document }: { document: OrderDocument }): Promise<{ result: string }> => {
      if (document.id === EXPLODE) {
        throw new Error('store write failed');
      }
      documents.push(clone(document));
      return { result: 'created' };
    },
  );

  const get = jest.fn(async ({ id }: { id: string }) => {
    if (id === EXPLODE) {
      // A 5xx must NOT be swallowed as "not found".
      throw Object.assign(new Error('store read failed'), {
        name: 'ResponseError',
        statusCode: 500,
        meta: { statusCode: 500 },
      });
    }
    const found = documents.find((document) => document.id === id);
    if (!found) {
      throw Object.assign(new Error('index_not_found_exception'), {
        name: 'ResponseError',
        statusCode: 404,
        meta: { statusCode: 404 },
      });
    }
    return { _source: clone(found) };
  });

  const search = jest.fn(async ({ from, size }: { from: number; size: number }) => {
    const sorted = [...documents].sort(newestFirst);
    return {
      hits: {
        total: { value: sorted.length, relation: 'eq' },
        hits: sorted
          .slice(from, from + size)
          .map((document) => ({ _source: clone(document) })),
      },
    };
  });

  const client = { index, get, search } as unknown as Client;

  return {
    repository: new ElasticsearchOrderRepository(client, INDEX),
    documents,
    seed: (...seeded) => {
      documents.length = 0;
      documents.push(...seeded.map(clone));
    },
    assertSaveSemantics: () => {
      expect(index).toHaveBeenCalledTimes(1);
      expect(index).toHaveBeenCalledWith(
        expect.objectContaining({
          index: INDEX,
          id: documents[0].id,
          // Without wait_for, a POST followed immediately by a GET/list could
          // miss the document inside the default 1s refresh interval.
          refresh: 'wait_for',
        }),
      );
    },
    assertListSemantics: ({ limit, offset }) => {
      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({
          index: INDEX,
          from: offset,
          size: limit,
          track_total_hits: true,
          sort: [{ createdAt: 'desc' }],
        }),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// MongoDB: a fake Collection<OrderDocument> over the same array semantics.
// ---------------------------------------------------------------------------
function createMongoSubject(): RepositoryUnderTest {
  const documents: OrderDocument[] = [];

  const insertOne = jest.fn(async (document: OrderDocument) => {
    if (document.id === EXPLODE) {
      throw new Error('store write failed');
    }
    documents.push(clone(document));
    return { acknowledged: true, insertedId: document.id };
  });

  const findOne = jest.fn(async ({ id }: { id: string }) => {
    if (id === EXPLODE) {
      throw new Error('store read failed');
    }
    const found = documents.find((document) => document.id === id);
    return found ? clone(found) : null;
  });

  const countDocuments = jest.fn(async () => documents.length);

  const sort = jest.fn();
  const skip = jest.fn();
  const limit = jest.fn();
  const find = jest.fn(() => {
    let working = [...documents].sort(newestFirst);
    const cursor = {
      sort: (...args: unknown[]) => {
        sort(...args);
        return cursor;
      },
      skip: (n: number) => {
        skip(n);
        working = working.slice(n);
        return cursor;
      },
      limit: (n: number) => {
        limit(n);
        working = working.slice(0, n);
        return cursor;
      },
      toArray: async () => working.map(clone),
    };
    return cursor;
  });

  const collection = {
    insertOne,
    findOne,
    countDocuments,
    find,
  } as unknown as OrdersCollection;

  return {
    repository: new MongoOrderRepository(collection),
    documents,
    seed: (...seeded) => {
      documents.length = 0;
      documents.push(...seeded.map(clone));
    },
    assertSaveSemantics: () => {
      expect(insertOne).toHaveBeenCalledTimes(1);
      // The domain id is a plain field with a unique index; Mongo's own _id is
      // never written by the adapter and never leaves it.
      expect(insertOne.mock.calls[0][0]).not.toHaveProperty('_id');
    },
    assertListSemantics: ({ limit: pageSize, offset }) => {
      expect(find).toHaveBeenCalledWith({}, { projection: { _id: 0 } });
      expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(skip).toHaveBeenCalledWith(offset);
      expect(limit).toHaveBeenCalledWith(pageSize);
    },
  };
}

// ---------------------------------------------------------------------------
// The same suite, both drivers. Identical expectations, identical inputs.
// ---------------------------------------------------------------------------
describeOrderRepositoryContract(
  'ElasticsearchOrderRepository',
  createElasticsearchSubject,
);
describeOrderRepositoryContract('MongoOrderRepository', createMongoSubject);

describe('cross-driver equivalence', () => {
  it('produces byte-identical results for the same operations', async () => {
    const es = createElasticsearchSubject();
    const mongo = createMongoSubject();

    const { CONTRACT_ORDERS } = await import('./order-repository.contract');

    const run = async (subject: RepositoryUnderTest) => {
      const saved = [];
      for (const order of CONTRACT_ORDERS) {
        saved.push(await subject.repository.save(order));
      }
      return {
        saved,
        fetched: await subject.repository.findById(CONTRACT_ORDERS[1].id),
        missing: await subject.repository.findById('nope'),
        page: await subject.repository.list({ limit: 2, offset: 1 }),
      };
    };

    expect(await run(es)).toEqual(await run(mongo));
  });
});

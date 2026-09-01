import { ExamplesObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

/**
 * Named request bodies shown in the Swagger UI's "Examples" dropdown for
 * `POST /api/orders`.
 *
 * Every one of them is **copy-paste runnable** against a running instance:
 * they use real products from the catalog seed data, they satisfy every
 * validator (two-word name, 5+ character address, ≤2 decimal prices), and the
 * totals in the comments below are what the service will actually compute.
 * The last one is deliberately *invalid* so a reader can see the 400 shape
 * without having to invent a broken payload.
 */
export const CREATE_ORDER_EXAMPLES: ExamplesObject = {
  hebrewOrder: {
    summary: 'Hebrew order (he) — the default path',
    description:
      'A Hebrew-locale shopper ordering two cartons of Milk 3% from the Dairy ' +
      'category. Server computes lineTotal 13.80, itemCount 2, totalAmount 13.80 ILS.',
    value: {
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
        },
      ],
      locale: 'he',
    },
  },

  englishOrder: {
    summary: 'English order (en) — multi-line cart',
    description:
      'The same API driven from the English UI, with three lines across two ' +
      'categories. Server computes lineTotals 13.80 / 8.90 / 13.90, itemCount 4, ' +
      'totalAmount 36.60 ILS — note that the client sends no totals at all.',
    value: {
      customer: {
        fullName: 'Dana Cohen',
        address: '10 Herzl St, Tel Aviv',
        email: 'dana.cohen@example.com',
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
        },
        {
          productId: 107,
          categoryId: 1,
          nameEn: 'Butter 100g',
          nameHe: 'חמאה 100 גרם',
          unit: 'pack',
          quantity: 1,
          unitPrice: 8.9,
        },
        {
          productId: 404,
          categoryId: 4,
          nameEn: 'Challah',
          nameHe: 'חלה',
          unit: 'unit',
          quantity: 1,
          unitPrice: 13.9,
        },
      ],
      locale: 'en',
    },
  },

  minimalOrder: {
    summary: 'Minimal body — locale omitted',
    description:
      '`locale` is the only optional field in the payload; leaving it out ' +
      'stores the order as `he`. Everything else is required.',
    value: {
      customer: {
        fullName: 'Israel Israeli',
        address: '10 Herzl St, Tel Aviv',
        email: 'israel@example.com',
      },
      items: [
        {
          productId: 201,
          categoryId: 2,
          nameEn: 'Bananas',
          nameHe: 'בננות',
          unit: 'kg',
          quantity: 3,
          unitPrice: 8.9,
        },
      ],
    },
  },

  rejectedTamperedTotal: {
    summary: 'Rejected: client tries to send its own total',
    description:
      'Returns `400` with `["property totalAmount should not exist"]`. Totals ' +
      'are derived server-side, so a payload that carries one is refused loudly ' +
      'rather than having the field quietly dropped.',
    value: {
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
        },
      ],
      locale: 'he',
      totalAmount: 0.01,
    },
  },
};

import { plainToInstance } from 'class-transformer';
import { ValidationError, validate } from 'class-validator';

import { validCreateOrderPayload } from '../../__tests__/fixtures';
import { CreateOrderDto } from './create-order.dto';
import { ListOrdersQueryDto } from './list-orders.query.dto';

/**
 * Mirrors the runtime `ValidationPipe` configuration from `app.setup.ts` so a
 * failure here means a real 400 in production, not a test-only artefact.
 */
async function validateBody(payload: unknown): Promise<ValidationError[]> {
  const instance = plainToInstance(CreateOrderDto, payload, {
    enableImplicitConversion: false,
  });
  return validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

/** Flattens nested `ValidationError`s to `["items.0.quantity", ...]` paths. */
function paths(errors: ValidationError[], prefix = ''): string[] {
  return errors.flatMap((error) => {
    const path = prefix ? `${prefix}.${error.property}` : error.property;
    const own = error.constraints ? [path] : [];
    return [...own, ...paths(error.children ?? [], path)];
  });
}

/** Collects the constraint keys reported at a given dotted path. */
function constraintsAt(errors: ValidationError[], target: string): string[] {
  const walk = (list: ValidationError[], prefix = ''): string[] =>
    list.flatMap((error) => {
      const path = prefix ? `${prefix}.${error.property}` : error.property;
      const own =
        path === target && error.constraints ? Object.keys(error.constraints) : [];
      return [...own, ...walk(error.children ?? [], path)];
    });
  return walk(errors);
}

describe('CreateOrderDto', () => {
  it('accepts the canonical payload from docs/CONTRACT.md §3', async () => {
    await expect(validateBody(validCreateOrderPayload())).resolves.toEqual([]);
  });

  it('accepts a payload without the optional locale', async () => {
    const payload = validCreateOrderPayload();
    delete payload.locale;
    await expect(validateBody(payload)).resolves.toEqual([]);
  });

  it('trims surrounding whitespace on string fields', async () => {
    const instance = plainToInstance(CreateOrderDto, {
      ...validCreateOrderPayload(),
      customer: {
        fullName: '  Israel Israeli  ',
        address: '  Herzl 10, Tel Aviv  ',
        email: '  israel@example.com  ',
      },
    });
    await expect(validate(instance)).resolves.toEqual([]);
    expect(instance.customer.fullName).toBe('Israel Israeli');
    expect(instance.customer.email).toBe('israel@example.com');
  });

  describe.each<[string, unknown, string, string]>([
    // --- customer.fullName ---------------------------------------------------
    [
      'empty fullName',
      validCreateOrderPayload({
        customer: { ...(validCreateOrderPayload().customer as object), fullName: '' },
      }),
      'customer.fullName',
      'isNotEmpty',
    ],
    [
      'one-word fullName',
      validCreateOrderPayload({
        customer: {
          fullName: 'Israel',
          address: 'Herzl 10, Tel Aviv',
          email: 'israel@example.com',
        },
      }),
      'customer.fullName',
      'isTwoWords',
    ],
    [
      'single-character fullName',
      validCreateOrderPayload({
        customer: {
          fullName: 'A',
          address: 'Herzl 10, Tel Aviv',
          email: 'israel@example.com',
        },
      }),
      'customer.fullName',
      'isLength',
    ],
    [
      'oversized fullName (121 chars)',
      validCreateOrderPayload({
        customer: {
          fullName: `${'a'.repeat(60)} ${'b'.repeat(60)}`,
          address: 'Herzl 10, Tel Aviv',
          email: 'israel@example.com',
        },
      }),
      'customer.fullName',
      'isLength',
    ],
    [
      'numeric fullName',
      validCreateOrderPayload({
        customer: {
          fullName: 12345,
          address: 'Herzl 10, Tel Aviv',
          email: 'israel@example.com',
        },
      }),
      'customer.fullName',
      'isString',
    ],
    // --- customer.address ----------------------------------------------------
    [
      'address shorter than 5 characters',
      validCreateOrderPayload({
        customer: {
          fullName: 'Israel Israeli',
          address: 'ab',
          email: 'israel@example.com',
        },
      }),
      'customer.address',
      'isLength',
    ],
    [
      'oversized address (251 chars)',
      validCreateOrderPayload({
        customer: {
          fullName: 'Israel Israeli',
          address: 'a'.repeat(251),
          email: 'israel@example.com',
        },
      }),
      'customer.address',
      'isLength',
    ],
    // --- customer.email ------------------------------------------------------
    [
      'malformed email',
      validCreateOrderPayload({
        customer: {
          fullName: 'Israel Israeli',
          address: 'Herzl 10, Tel Aviv',
          email: 'not-an-email',
        },
      }),
      'customer.email',
      'isEmail',
    ],
    [
      'email over 200 characters',
      validCreateOrderPayload({
        customer: {
          fullName: 'Israel Israeli',
          address: 'Herzl 10, Tel Aviv',
          email: `${'a'.repeat(200)}@example.com`,
        },
      }),
      'customer.email',
      'maxLength',
    ],
    [
      'missing email',
      validCreateOrderPayload({
        customer: { fullName: 'Israel Israeli', address: 'Herzl 10, Tel Aviv' },
      }),
      'customer.email',
      'isNotEmpty',
    ],
    // --- customer itself -----------------------------------------------------
    [
      'missing customer',
      { items: validCreateOrderPayload().items },
      'customer',
      'isDefined',
    ],
    [
      'customer is not an object',
      validCreateOrderPayload({ customer: 'israel' }),
      'customer',
      'isObject',
    ],
    // --- items ---------------------------------------------------------------
    [
      'empty items array',
      validCreateOrderPayload({ items: [] }),
      'items',
      'arrayMinSize',
    ],
    [
      'missing items',
      { customer: validCreateOrderPayload().customer },
      'items',
      'isDefined',
    ],
    [
      'items is not an array',
      validCreateOrderPayload({ items: { productId: 1 } }),
      'items',
      'isArray',
    ],
    [
      'more than 100 items',
      validCreateOrderPayload({
        items: Array.from({ length: 101 }, () => ({
          productId: 101,
          categoryId: 1,
          nameEn: 'Milk 3%',
          nameHe: 'חלב 3%',
          unit: 'carton',
          quantity: 1,
          unitPrice: 6.9,
        })),
      }),
      'items',
      'arrayMaxSize',
    ],
    // --- items[0] ------------------------------------------------------------
    [
      'quantity of 0',
      validCreateOrderPayload({
        items: [{ ...(validCreateOrderPayload().items as object[])[0], quantity: 0 }],
      }),
      'items.0.quantity',
      'min',
    ],
    [
      'quantity of 1000',
      validCreateOrderPayload({
        items: [{ ...(validCreateOrderPayload().items as object[])[0], quantity: 1000 }],
      }),
      'items.0.quantity',
      'max',
    ],
    [
      'fractional quantity',
      validCreateOrderPayload({
        items: [{ ...(validCreateOrderPayload().items as object[])[0], quantity: 1.5 }],
      }),
      'items.0.quantity',
      'isInt',
    ],
    [
      'negative unitPrice',
      validCreateOrderPayload({
        items: [{ ...(validCreateOrderPayload().items as object[])[0], unitPrice: -1 }],
      }),
      'items.0.unitPrice',
      'min',
    ],
    [
      'unitPrice with three decimals',
      validCreateOrderPayload({
        items: [
          { ...(validCreateOrderPayload().items as object[])[0], unitPrice: 6.999 },
        ],
      }),
      'items.0.unitPrice',
      'isNumber',
    ],
    [
      'unitPrice sent as a string',
      validCreateOrderPayload({
        items: [
          { ...(validCreateOrderPayload().items as object[])[0], unitPrice: '6.90' },
        ],
      }),
      'items.0.unitPrice',
      'isNumber',
    ],
    [
      'zero productId',
      validCreateOrderPayload({
        items: [{ ...(validCreateOrderPayload().items as object[])[0], productId: 0 }],
      }),
      'items.0.productId',
      'isPositive',
    ],
    [
      'negative categoryId',
      validCreateOrderPayload({
        items: [{ ...(validCreateOrderPayload().items as object[])[0], categoryId: -3 }],
      }),
      'items.0.categoryId',
      'isPositive',
    ],
    [
      'empty nameEn',
      validCreateOrderPayload({
        items: [{ ...(validCreateOrderPayload().items as object[])[0], nameEn: '' }],
      }),
      'items.0.nameEn',
      'isNotEmpty',
    ],
    [
      'empty nameHe',
      validCreateOrderPayload({
        items: [{ ...(validCreateOrderPayload().items as object[])[0], nameHe: '  ' }],
      }),
      'items.0.nameHe',
      'isNotEmpty',
    ],
    [
      'oversized nameEn (201 chars)',
      validCreateOrderPayload({
        items: [
          {
            ...(validCreateOrderPayload().items as object[])[0],
            nameEn: 'a'.repeat(201),
          },
        ],
      }),
      'items.0.nameEn',
      'maxLength',
    ],
    [
      'a numeric nameEn (the trim transform must pass non-strings through)',
      validCreateOrderPayload({
        items: [{ ...(validCreateOrderPayload().items as object[])[0], nameEn: 42 }],
      }),
      'items.0.nameEn',
      'isString',
    ],
    [
      'oversized unit (33 chars)',
      validCreateOrderPayload({
        items: [
          { ...(validCreateOrderPayload().items as object[])[0], unit: 'u'.repeat(33) },
        ],
      }),
      'items.0.unit',
      'maxLength',
    ],
    [
      'missing unit',
      validCreateOrderPayload({
        items: [
          {
            productId: 101,
            categoryId: 1,
            nameEn: 'Milk 3%',
            nameHe: 'חלב 3%',
            quantity: 2,
            unitPrice: 6.9,
          },
        ],
      }),
      'items.0.unit',
      'isNotEmpty',
    ],
    // --- locale --------------------------------------------------------------
    ['unsupported locale', validCreateOrderPayload({ locale: 'fr' }), 'locale', 'isIn'],
    // --- forbidNonWhitelisted ------------------------------------------------
    [
      'unknown top-level property',
      validCreateOrderPayload({ totalAmount: 0.01 }),
      'totalAmount',
      'whitelistValidation',
    ],
    [
      'unknown nested customer property',
      validCreateOrderPayload({
        customer: {
          fullName: 'Israel Israeli',
          address: 'Herzl 10, Tel Aviv',
          email: 'israel@example.com',
          isAdmin: true,
        },
      }),
      'customer.isAdmin',
      'whitelistValidation',
    ],
    [
      'client-supplied lineTotal on an item',
      validCreateOrderPayload({
        items: [{ ...(validCreateOrderPayload().items as object[])[0], lineTotal: 0.01 }],
      }),
      'items.0.lineTotal',
      'whitelistValidation',
    ],
  ])('rejects %s', (_name, payload, path, constraint) => {
    it(`reports "${constraint}" at ${path}`, async () => {
      const errors = await validateBody(payload);
      expect(paths(errors)).toContain(path);
      expect(constraintsAt(errors, path)).toContain(constraint);
    });
  });

  it('reports every offending item, not just the first', async () => {
    const base = (validCreateOrderPayload().items as object[])[0];
    const errors = await validateBody(
      validCreateOrderPayload({
        items: [{ ...base, quantity: 0 }, { ...base }, { ...base, unitPrice: -5 }],
      }),
    );
    expect(paths(errors)).toEqual(
      expect.arrayContaining(['items.0.quantity', 'items.2.unitPrice']),
    );
    expect(paths(errors)).not.toContain('items.1.quantity');
  });
});

describe('ListOrdersQueryDto', () => {
  const parse = (query: unknown): ListOrdersQueryDto =>
    plainToInstance(ListOrdersQueryDto, query);

  it('defaults to limit=20 offset=0', async () => {
    const dto = parse({});
    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.limit).toBe(20);
    expect(dto.offset).toBe(0);
  });

  it('coerces the numeric query string values', async () => {
    const dto = parse({ limit: '5', offset: '40' });
    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.limit).toBe(5);
    expect(dto.offset).toBe(40);
  });

  it.each<[string, unknown, string, string]>([
    ['limit of 0', { limit: '0' }, 'limit', 'min'],
    ['limit above 100', { limit: '101' }, 'limit', 'max'],
    ['negative offset', { offset: '-1' }, 'offset', 'min'],
    ['non-numeric limit', { limit: 'ten' }, 'limit', 'isInt'],
    ['fractional offset', { offset: '1.5' }, 'offset', 'isInt'],
  ])('rejects %s with %s', async (_name, query, property, constraint) => {
    const errors = await validate(parse(query), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(constraintsAt(errors, property)).toContain(constraint);
  });

  it('rejects an unknown query parameter', async () => {
    const errors = await validate(parse({ sort: 'asc' }), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(constraintsAt(errors, 'sort')).toContain('whitelistValidation');
  });
});

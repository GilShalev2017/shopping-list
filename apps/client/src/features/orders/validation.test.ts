import { describe, expect, it } from 'vitest';
import {
  ADDRESS_MAX,
  EMAIL_MAX,
  FULL_NAME_MAX,
  isCustomerValid,
  normalizeCustomer,
  validateCustomer,
} from './validation';
import type { OrderCustomer } from '@/types/orders';

const valid: OrderCustomer = {
  fullName: 'Dana Levi',
  address: 'Herzl 10, Tel Aviv',
  email: 'dana@example.com',
};

describe('validateCustomer', () => {
  it('accepts a fully valid customer', () => {
    expect(validateCustomer(valid)).toEqual({});
    expect(isCustomerValid(valid)).toBe(true);
  });

  it('accepts Hebrew names and addresses', () => {
    expect(
      validateCustomer({
        fullName: 'ישראל ישראלי',
        address: 'הרצל 10, תל אביב',
        email: 'israel@example.co.il',
      }),
    ).toEqual({});
  });

  describe('fullName', () => {
    it.each([
      ['', 'validation.fullNameRequired'],
      ['   ', 'validation.fullNameRequired'],
      ['A', 'validation.fullNameTooShort'],
      ['Dana', 'validation.fullNameTwoWords'],
      ['ישראל', 'validation.fullNameTwoWords'],
    ])('rejects %j with %s', (fullName, expected) => {
      expect(validateCustomer({ ...valid, fullName }).fullName).toBe(expected);
    });

    it('rejects a name beyond the maximum length', () => {
      const fullName = `${'a'.repeat(FULL_NAME_MAX)} b`;
      expect(validateCustomer({ ...valid, fullName }).fullName).toBe(
        'validation.fullNameTooShort',
      );
    });

    it('accepts a three-part name', () => {
      expect(validateCustomer({ ...valid, fullName: 'Dana Bat Levi' }).fullName).toBeUndefined();
    });

    it('treats multiple spaces between the parts as valid', () => {
      expect(validateCustomer({ ...valid, fullName: 'Dana    Levi' }).fullName).toBeUndefined();
    });
  });

  describe('address', () => {
    it.each([
      ['', 'validation.addressRequired'],
      ['  ', 'validation.addressRequired'],
      ['abc', 'validation.addressTooShort'],
    ])('rejects %j with %s', (address, expected) => {
      expect(validateCustomer({ ...valid, address }).address).toBe(expected);
    });

    it('rejects an address beyond the maximum length', () => {
      expect(
        validateCustomer({ ...valid, address: 'a'.repeat(ADDRESS_MAX + 1) }).address,
      ).toBe('validation.addressTooShort');
    });
  });

  describe('email', () => {
    it.each([
      ['', 'validation.emailRequired'],
      ['   ', 'validation.emailRequired'],
      ['not-an-email', 'validation.emailInvalid'],
      ['missing@domain', 'validation.emailInvalid'],
      ['@example.com', 'validation.emailInvalid'],
      ['spaces in@example.com', 'validation.emailInvalid'],
      ['double@@example.com', 'validation.emailInvalid'],
      ['trailing@example.', 'validation.emailInvalid'],
    ])('rejects %j with %s', (email, expected) => {
      expect(validateCustomer({ ...valid, email }).email).toBe(expected);
    });

    it.each(['a@b.co', 'first.last@sub.example.co.il', 'user+tag@example.com'])(
      'accepts %s',
      (email) => {
        expect(validateCustomer({ ...valid, email }).email).toBeUndefined();
      },
    );

    it('rejects an email beyond the maximum length', () => {
      const email = `${'a'.repeat(EMAIL_MAX)}@example.com`;
      expect(validateCustomer({ ...valid, email }).email).toBe('validation.emailInvalid');
    });
  });

  it('reports every invalid field at once', () => {
    const errors = validateCustomer({ fullName: '', address: '', email: '' });
    expect(Object.keys(errors).sort()).toEqual(['address', 'email', 'fullName']);
    expect(isCustomerValid({ fullName: '', address: '', email: '' })).toBe(false);
  });
});

describe('normalizeCustomer', () => {
  it('trims, collapses whitespace in the name, and lowercases the email', () => {
    expect(
      normalizeCustomer({
        fullName: '  Dana    Levi  ',
        address: '  Herzl 10, Tel Aviv  ',
        email: '  DANA@Example.COM ',
      }),
    ).toEqual({
      fullName: 'Dana Levi',
      address: 'Herzl 10, Tel Aviv',
      email: 'dana@example.com',
    });
  });

  it('leaves an already clean customer untouched', () => {
    expect(normalizeCustomer(valid)).toEqual(valid);
  });
});

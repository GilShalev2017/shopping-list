import type { OrderCustomer } from '@/types/orders';

export type CustomerField = keyof OrderCustomer;
export type CustomerErrors = Partial<Record<CustomerField, string>>;

export const FULL_NAME_MIN = 2;
export const FULL_NAME_MAX = 120;
export const ADDRESS_MIN = 5;
export const ADDRESS_MAX = 250;
export const EMAIL_MAX = 200;

/**
 * Deliberately conservative: matches the practical subset that the NestJS
 * `@IsEmail()` on the server accepts, so the client never reports a field valid
 * that the server will then reject.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * Returns i18n *keys*, never rendered strings, so validation stays pure and
 * re-renders correctly when the user flips the language mid-form.
 */
export const validateCustomer = (customer: OrderCustomer): CustomerErrors => {
  const errors: CustomerErrors = {};

  const fullName = customer.fullName.trim();
  if (fullName.length === 0) {
    errors.fullName = 'validation.fullNameRequired';
  } else if (fullName.length < FULL_NAME_MIN || fullName.length > FULL_NAME_MAX) {
    errors.fullName = 'validation.fullNameTooShort';
  } else if (fullName.split(/\s+/).filter(Boolean).length < 2) {
    // The assignment asks for "first and last name" in one field.
    errors.fullName = 'validation.fullNameTwoWords';
  }

  const address = customer.address.trim();
  if (address.length === 0) {
    errors.address = 'validation.addressRequired';
  } else if (address.length < ADDRESS_MIN || address.length > ADDRESS_MAX) {
    errors.address = 'validation.addressTooShort';
  }

  const email = customer.email.trim();
  if (email.length === 0) {
    errors.email = 'validation.emailRequired';
  } else if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
    errors.email = 'validation.emailInvalid';
  }

  return errors;
};

export const isCustomerValid = (customer: OrderCustomer): boolean =>
  Object.keys(validateCustomer(customer)).length === 0;

/** Trims every field before it goes on the wire. */
export const normalizeCustomer = (customer: OrderCustomer): OrderCustomer => ({
  fullName: customer.fullName.trim().replace(/\s+/g, ' '),
  address: customer.address.trim(),
  email: customer.email.trim().toLowerCase(),
});

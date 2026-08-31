import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export const IS_TWO_WORDS = 'isTwoWords';

/**
 * A full name must be at least two words. Unicode-aware, so Hebrew
 * ("ישראל ישראלי"), Arabic and accented Latin names all pass, while
 * "Israel" or "   " do not. Any whitespace run counts as a separator and
 * punctuation-only tokens (e.g. "-") are not counted as words.
 */
export function containsAtLeastTwoWords(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const words = value
    .trim()
    .split(/\s+/u)
    .filter((word) => /\p{L}|\p{N}/u.test(word));
  return words.length >= 2;
}

@ValidatorConstraint({ name: IS_TWO_WORDS, async: false })
export class IsTwoWordsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return containsAtLeastTwoWords(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must contain at least two words`;
  }
}

/** Property decorator form, used by `OrderCustomerDto.fullName`. */
export function IsTwoWords(validationOptions?: ValidationOptions): PropertyDecorator {
  return function decorate(target: object, propertyName: string | symbol): void {
    registerDecorator({
      name: IS_TWO_WORDS,
      target: target.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: IsTwoWordsConstraint,
    });
  };
}

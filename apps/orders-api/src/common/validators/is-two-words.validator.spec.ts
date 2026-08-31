import { ValidationArguments } from 'class-validator';

import { IsTwoWordsConstraint, containsAtLeastTwoWords } from './is-two-words.validator';

describe('containsAtLeastTwoWords', () => {
  it.each([
    ['ישראל ישראלי', true],
    ['Israel Israeli', true],
    ['  Israel   Israeli  ', true],
    ['Jean-Luc Picard', true],
    ['María José García', true],
    ['محمد علي', true],
    ['Israel', false],
    ['ישראל', false],
    ['', false],
    ['   ', false],
    ['-', false],
    ['- -', false],
    ['A B', true],
    ['X 1', true],
  ])('%p -> %p', (value, expected) => {
    expect(containsAtLeastTwoWords(value)).toBe(expected);
  });

  it.each([undefined, null, 42, {}, [], true])('rejects the non-string %p', (value) => {
    expect(containsAtLeastTwoWords(value)).toBe(false);
  });
});

describe('IsTwoWordsConstraint', () => {
  const constraint = new IsTwoWordsConstraint();

  it('delegates to containsAtLeastTwoWords', () => {
    expect(constraint.validate('Israel Israeli')).toBe(true);
    expect(constraint.validate('Israel')).toBe(false);
  });

  it('produces a message naming the offending property', () => {
    const args = { property: 'fullName' } as ValidationArguments;
    expect(constraint.defaultMessage(args)).toBe(
      'fullName must contain at least two words',
    );
  });
});

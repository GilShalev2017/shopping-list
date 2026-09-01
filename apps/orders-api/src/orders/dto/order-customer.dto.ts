import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

import { IsTwoWords } from '../../common/validators/is-two-words.validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * `docs/CONTRACT.md` §3 — the three required form fields on screen 2.
 *
 * Every `@ApiProperty` below mirrors the `class-validator` decorators next to
 * it (`minLength`/`maxLength`/`format`), so the schema a reader sees in Swagger
 * is the contract the pipe actually enforces rather than a prose approximation
 * of it.
 */
export class OrderCustomerDto {
  @ApiProperty({
    description:
      "The shopper's full name. Must contain **at least two words** — enforced " +
      'by a custom, Unicode-aware `@IsTwoWords()` validator, so `ישראל ישראלי` ' +
      'and `Israel Israeli` both pass while `ישראל` alone does not. ' +
      'Leading/trailing whitespace is trimmed before validation. ' +
      'Other accepted values: `Israel Israeli`, `שרה בת-אברהם`.',
    example: 'ישראל ישראלי',
    minLength: 2,
    maxLength: 120,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  @IsTwoWords()
  fullName: string;

  @ApiProperty({
    description:
      'Free-text delivery address. Not parsed or geocoded — it is stored and ' +
      'echoed back verbatim, and indexed as full text so orders can be searched ' +
      'by street. Trimmed before validation. English addresses such as ' +
      '`10 Herzl St, Tel Aviv` are equally valid — the field is locale-agnostic.',
    example: 'הרצל 10, תל אביב',
    minLength: 5,
    maxLength: 250,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(5, 250)
  address: string;

  @ApiProperty({
    description:
      'Contact e-mail for the order confirmation. Validated with `@IsEmail()`. ' +
      'Stored as a `keyword` with a lowercase normalizer, so `A@X.com` and ' +
      '`a@x.com` are the same term when searching.',
    example: 'israel@example.com',
    format: 'email',
    maxLength: 200,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @IsEmail()
  email: string;
}

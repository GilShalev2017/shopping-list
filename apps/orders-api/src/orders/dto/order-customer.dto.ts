import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

import { IsTwoWords } from '../../common/validators/is-two-words.validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** `docs/CONTRACT.md` §3 — the three required form fields on screen 2. */
export class OrderCustomerDto {
  @ApiProperty({ example: 'ישראל ישראלי', minLength: 2, maxLength: 120 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  @IsTwoWords()
  fullName: string;

  @ApiProperty({ example: 'הרצל 10, תל אביב', minLength: 5, maxLength: 250 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(5, 250)
  address: string;

  @ApiProperty({ example: 'israel@example.com', maxLength: 200 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @IsEmail()
  email: string;
}

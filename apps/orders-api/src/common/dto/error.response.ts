import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ---------------------------------------------------------------------------
 * Documentation-only response classes.
 * ---------------------------------------------------------------------------
 * Nothing in this file is ever instantiated by the application. The bodies they
 * describe are produced by Nest's own `HttpException` filter (and, for the 400,
 * by the global `ValidationPipe`), so these classes exist purely to give the
 * OpenAPI document a real schema for the error responses instead of an empty
 * `{}` — which is what an `@ApiBadRequestResponse({ description })` alone
 * produces.
 *
 * They are deliberately *descriptions of existing behaviour*: no interceptor,
 * no filter and no serialisation step was added, so the wire format is byte for
 * byte what it was before. `docs/CONTRACT.md` §3 pins the 400 shape.
 */

/**
 * `400 Bad Request` — emitted by the global `ValidationPipe`.
 *
 * `message` is always an **array**, one entry per violated constraint, because
 * the pipe reports every failure at once rather than stopping at the first.
 * The strings are dotted paths (`items.0.quantity`) thanks to
 * `@ValidateNested({ each: true })`, which is what lets the client highlight
 * the exact field that failed.
 */
export class ValidationErrorResponse {
  @ApiProperty({
    example: 400,
    enum: [400],
    description: 'Always 400. Mirrors the HTTP status line.',
  })
  statusCode: number;

  @ApiProperty({
    example: 'Bad Request',
    description: 'The HTTP reason phrase.',
  })
  error: string;

  @ApiProperty({
    type: [String],
    description:
      'One human-readable message per violated constraint — every violation in ' +
      'the payload, not just the first. Nested paths are dotted.',
    example: [
      'customer.email must be an email',
      'customer.fullName must contain at least two words',
      'items.0.quantity must not be less than 1',
      'property totalAmount should not exist',
    ],
  })
  message: string[];
}

/**
 * `404 Not Found` — Nest's default `NotFoundException` body. Note that `message`
 * is a plain **string** here, not an array: that difference is real, and a
 * client that blindly `.join()`s it would be surprised, so it is documented.
 */
export class NotFoundErrorResponse {
  @ApiProperty({
    example: 404,
    enum: [404],
    description: 'Always 404.',
  })
  statusCode: number;

  @ApiProperty({
    example: 'Order 01J8ZK9X7QF3M2N4P5R6S7T8V9 was not found.',
    description: 'A single message string (not an array, unlike the 400 body).',
  })
  message: string;

  @ApiPropertyOptional({
    example: 'Not Found',
    description: 'The HTTP reason phrase.',
  })
  error?: string;
}

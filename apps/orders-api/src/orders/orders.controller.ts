import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import {
  NotFoundErrorResponse,
  ValidationErrorResponse,
} from '../common/dto/error.response';
import { CreateOrderDto } from './dto/create-order.dto';
import { CREATE_ORDER_EXAMPLES } from './dto/create-order.examples';
import {
  DEFAULT_LIST_LIMIT,
  DEFAULT_LIST_OFFSET,
  ListOrdersQueryDto,
  MAX_LIST_LIMIT,
} from './dto/list-orders.query.dto';
import { Order, PaginatedOrders } from './entities/order.entity';
import { OrdersService } from './orders.service';

/**
 * `docs/CONTRACT.md` §3. Mounted under the global `/api` prefix.
 *
 * All three routes are thin: they validate (via the global pipe and the DTOs),
 * delegate to {@link OrdersService} and return whatever it produces. There is
 * no serialisation interceptor and no response mapping in between, so the
 * documented schemas below describe the literal bytes on the wire.
 */
@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    operationId: 'createOrder',
    summary: 'Confirm an order (screen 2 "Send order")',
    description: [
      'Persists the three delivery-form fields from screen 2 together with the',
      'cart carried over from screen 1, and returns the stored order.',
      '',
      '**The server owns the money.** `lineTotal`, `itemCount` and `totalAmount`',
      'are recomputed here from `quantity` and `unitPrice` and rounded to agorot;',
      'a request that tries to send any of them is rejected with `400` by',
      '`forbidNonWhitelisted`, so tampering is loud rather than silent.',
      '`id` (ULID), `reference`, `status`, `currency` and `createdAt` are',
      'server-generated too.',
      '',
      'The write is durable and immediately readable: the Elasticsearch adapter',
      'indexes with `refresh: "wait_for"`, so the `GET /api/orders/{id}` that the',
      'confirmation screen fires next cannot miss it.',
      '',
      'Which store receives the document depends on `NOSQL_DRIVER`; the response',
      'is identical either way.',
    ].join('\n'),
  })
  @ApiBody({
    type: CreateOrderDto,
    required: true,
    description:
      'The order to confirm. Pick a ready-made body from the **Examples** ' +
      'dropdown — each one is runnable as-is against a live instance.',
    examples: CREATE_ORDER_EXAMPLES,
  })
  @ApiCreatedResponse({
    description:
      'The order was stored. The body is the complete order including every ' +
      'server-computed field.',
    type: Order,
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed. `message` is an array with one entry per violated ' +
      'constraint — including `property … should not exist` for any field the ' +
      'client is not allowed to send.',
    type: ValidationErrorResponse,
  })
  create(@Body() createOrderDto: CreateOrderDto): Promise<Order> {
    return this.ordersService.create(createOrderDto);
  }

  @Get()
  @ApiOperation({
    operationId: 'listOrders',
    summary: 'List stored orders, newest first',
    description: [
      'Offset-paginated listing used to demonstrate that the orders really',
      'landed in the NoSQL store — it is not consumed by screen 2 itself.',
      '',
      'Ordering is by `createdAt` descending, which the ULID `id` agrees with.',
      '`total` is the full match count in the store, so a client can render',
      '"showing 20 of 137" from a single request.',
      '',
      'An out-of-range `offset` returns an empty `items` array with the real',
      '`total`, not a `404`.',
    ].join('\n'),
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description:
      `Page size, 1..${MAX_LIST_LIMIT}. Defaults to ${DEFAULT_LIST_LIMIT}. ` +
      'A value outside the range is a `400`, never a silent clamp.',
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: MAX_LIST_LIMIT,
      default: DEFAULT_LIST_LIMIT,
      example: DEFAULT_LIST_LIMIT,
    },
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: `How many orders to skip from the newest. Defaults to ${DEFAULT_LIST_OFFSET}.`,
    schema: {
      type: 'integer',
      minimum: 0,
      default: DEFAULT_LIST_OFFSET,
      example: DEFAULT_LIST_OFFSET,
    },
  })
  @ApiOkResponse({
    description: 'One page of orders plus the total match count.',
    type: PaginatedOrders,
  })
  @ApiBadRequestResponse({
    description:
      'A pagination parameter is out of range, not an integer, or unknown ' +
      '(`?sort=asc` is rejected — the query DTO is whitelisted too).',
    type: ValidationErrorResponse,
  })
  findAll(@Query() query: ListOrdersQueryDto): Promise<PaginatedOrders> {
    return this.ordersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'getOrderById',
    summary: 'Fetch a single order by id',
    description: [
      'Reads one order back out of the store by its server-generated ULID —',
      'the call the confirmation screen makes after a successful `POST`.',
      '',
      'Look-ups are by `id` only. `reference` (`ORD-8F3A21`) is a short,',
      'human-facing label for reading out loud; it is not guaranteed unique and',
      'is deliberately not a lookup key.',
    ].join('\n'),
  })
  @ApiParam({
    name: 'id',
    description:
      'The order id returned by `POST /api/orders` — a 26-character ULID in ' +
      'Crockford base32.',
    schema: {
      type: 'string',
      pattern: '^[0-9A-HJKMNP-TV-Z]{26}$',
      minLength: 26,
      maxLength: 26,
      example: '01J8ZK9X7QF3M2N4P5R6S7T8V9',
    },
  })
  @ApiOkResponse({
    description: 'The stored order.',
    type: Order,
  })
  @ApiNotFoundResponse({
    description: 'No order with that id exists in the configured store.',
    type: NotFoundErrorResponse,
  })
  findOne(@Param('id') id: string): Promise<Order> {
    return this.ordersService.findOne(id);
  }
}

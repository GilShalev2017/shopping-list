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
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders.query.dto';
import { Order, PaginatedOrders } from './entities/order.entity';
import { OrdersService } from './orders.service';

/** `docs/CONTRACT.md` §3. Mounted under the global `/api` prefix. */
@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Confirm an order',
    description:
      'Totals are recomputed server-side; any client-sent lineTotal/totalAmount is ignored.',
  })
  @ApiCreatedResponse({ type: Order })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  create(@Body() createOrderDto: CreateOrderDto): Promise<Order> {
    return this.ordersService.create(createOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'List orders, newest first' })
  @ApiOkResponse({ type: PaginatedOrders })
  findAll(@Query() query: ListOrdersQueryDto): Promise<PaginatedOrders> {
    return this.ordersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a single order by id' })
  @ApiParam({ name: 'id', example: '01J8ZK9X7QF3M2N4P5R6S7T8V9' })
  @ApiOkResponse({ type: Order })
  @ApiNotFoundResponse({ description: 'No order with that id.' })
  findOne(@Param('id') id: string): Promise<Order> {
    return this.ordersService.findOne(id);
  }
}

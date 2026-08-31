import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { createOrderDto, orderFixture } from '../__tests__/fixtures';
import { ListOrdersQueryDto } from './dto/list-orders.query.dto';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: { create: jest.Mock; findOne: jest.Mock; findAll: jest.Mock };

  beforeEach(async () => {
    service = { create: jest.fn(), findOne: jest.fn(), findAll: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: service }],
    }).compile();

    controller = moduleRef.get(OrdersController);
  });

  describe('POST /orders', () => {
    it('delegates the DTO to the service and returns the created order', async () => {
      const created = orderFixture();
      const dto = createOrderDto();
      service.create.mockResolvedValue(created);

      await expect(controller.create(dto)).resolves.toBe(created);
      expect(service.create).toHaveBeenCalledTimes(1);
      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('propagates service failures', async () => {
      service.create.mockRejectedValue(new Error('store unavailable'));
      await expect(controller.create(createOrderDto())).rejects.toThrow(
        'store unavailable',
      );
    });
  });

  describe('GET /orders', () => {
    it('passes the query DTO through and returns the paginated envelope', async () => {
      const page = { total: 3, items: [orderFixture()] };
      service.findAll.mockResolvedValue(page);

      const query = new ListOrdersQueryDto();
      query.limit = 10;
      query.offset = 20;

      await expect(controller.findAll(query)).resolves.toBe(page);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('returns an empty envelope when the store is empty', async () => {
      service.findAll.mockResolvedValue({ total: 0, items: [] });
      await expect(controller.findAll(new ListOrdersQueryDto())).resolves.toEqual({
        total: 0,
        items: [],
      });
    });
  });

  describe('GET /orders/:id', () => {
    it('returns the order for a known id', async () => {
      const order = orderFixture();
      service.findOne.mockResolvedValue(order);

      await expect(controller.findOne(order.id)).resolves.toBe(order);
      expect(service.findOne).toHaveBeenCalledWith(order.id);
    });

    it('surfaces the service NotFoundException so Nest maps it to a 404', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Order x was not found.'));

      await expect(controller.findOne('x')).rejects.toBeInstanceOf(NotFoundException);
      await expect(controller.findOne('x')).rejects.toMatchObject({
        status: 404,
      });
    });
  });
});

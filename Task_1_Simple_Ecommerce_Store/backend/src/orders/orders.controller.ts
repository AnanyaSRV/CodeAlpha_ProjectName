
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateFulfillmentStatusDto } from './dto/update-fulfillment-status.dto.js';
import { OrdersService } from './orders.service.js';

interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    email: string;
    role: 'CUSTOMER' | 'VENDOR' | 'DELIVERY' | 'ADMIN';
  };
}

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles('CUSTOMER')
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(request.user.sub, dto);
  }

  @Get('my')
  @Roles('CUSTOMER')
  getMyOrders(@Req() request: AuthenticatedRequest) {
    return this.ordersService.getMyOrders(request.user.sub);
  }

  @Get('vendor')
  @Roles('VENDOR')
  getVendorOrders(@Req() request: AuthenticatedRequest) {
    return this.ordersService.getVendorOrders(request.user.sub);
  }

  @Patch('vendor/items/:itemId/status')
  @Roles('VENDOR')
  updateVendorItemStatus(
    @Req() request: AuthenticatedRequest,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateFulfillmentStatusDto,
  ) {
    return this.ordersService.updateVendorItemStatus(
      request.user.sub,
      itemId,
      dto.status,
    );
  }
}

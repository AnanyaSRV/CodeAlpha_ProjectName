import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { DeliveryService } from './delivery.service.js';

interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    email: string;
    role: 'CUSTOMER' | 'VENDOR' | 'DELIVERY' | 'ADMIN';
  };
}

@Controller('delivery')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DELIVERY')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get('orders')
  getAssignedOrders(@Req() request: AuthenticatedRequest) {
    return this.deliveryService.getAssignedOrders(request.user.sub);
  }

  @Patch('orders/:id/status')
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { status: 'OUT_FOR_DELIVERY' | 'DELIVERED' },
  ) {
    return this.deliveryService.updateDeliveryStatus(
      request.user.sub,
      id,
      body.status,
    );
  }
}
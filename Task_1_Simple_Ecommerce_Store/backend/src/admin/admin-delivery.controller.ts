import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { AdminDeliveryService } from './admin-delivery.service.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminDeliveryController {
  constructor(
    private readonly adminDeliveryService: AdminDeliveryService,
  ) {}

  @Get('delivery-partners')
  getDeliveryPartners() {
    return this.adminDeliveryService.getDeliveryPartners();
  }

  @Patch('orders/:id/assign-delivery')
  assignDeliveryPartner(
    @Param('id') id: string,
    @Body() body: { deliveryPartnerId: string },
  ) {
    return this.adminDeliveryService.assignDeliveryPartner(
      id,
      body.deliveryPartnerId,
    );
  }
}
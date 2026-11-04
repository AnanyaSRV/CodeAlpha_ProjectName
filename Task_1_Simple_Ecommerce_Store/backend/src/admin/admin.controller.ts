
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
import { AdminService } from './admin.service.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('users')
  getUsers() {
    return this.adminService.getUsers();
  }

  @Patch('users/:id/delivery-role')
  promoteUserToDeliveryPartner(@Param('id') id: string) {
    return this.adminService.promoteUserToDeliveryPartner(id);
  }

  @Get('products')
  getProducts() {
    return this.adminService.getProducts();
  }

  @Patch('products/:id/status')
  updateProductStatus(
    @Param('id') id: string,
    @Body() body: { active: boolean },
  ) {
    return this.adminService.updateProductStatus(id, body.active);
  }

  @Get('orders')
  getOrders() {
    return this.adminService.getOrders();
  }
}

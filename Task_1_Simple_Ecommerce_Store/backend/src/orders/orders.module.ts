
import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/roles.guard.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { ExpiredOrdersService } from './expired-orders.service.js';

@Module({
  controllers: [OrdersController],
  providers: [
    OrdersService,
    ExpiredOrdersService,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class OrdersModule {}

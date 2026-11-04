import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RolesGuard } from '../common/roles.guard.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AdminDeliveryController } from './admin-delivery.controller.js';
import { AdminDeliveryService } from './admin-delivery.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminController, AdminDeliveryController],
  providers: [
    AdminService,
    AdminDeliveryService,
    RolesGuard,
  ],
})
export class AdminModule {}
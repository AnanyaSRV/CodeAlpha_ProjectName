import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RolesGuard } from '../common/roles.guard.js';
import { DeliveryController } from './delivery.controller.js';
import { DeliveryService } from './delivery.service.js';

@Module({
  imports: [AuthModule],
  controllers: [DeliveryController],
  providers: [DeliveryService, RolesGuard],
})
export class DeliveryModule {}
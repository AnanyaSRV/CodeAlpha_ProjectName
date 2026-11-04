
import { Module } from '@nestjs/common';
import { VendorsController } from './vendors.controller.js';
import { VendorsService } from './vendors.service.js';
import { RolesGuard } from '../common/roles.guard.js';

@Module({
  controllers: [VendorsController],
  providers: [VendorsService, RolesGuard],
})
export class VendorsModule {}

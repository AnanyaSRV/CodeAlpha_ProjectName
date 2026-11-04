
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
import { ApplyVendorDto } from './dto/apply-vendor.dto.js';
import { RejectVendorApplicationDto } from './dto/reject-vendor-application.dto.js';
import { VendorsService } from './vendors.service.js';

interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    email: string;
    role: 'CUSTOMER' | 'VENDOR' | 'DELIVERY' | 'ADMIN';
  };
}

@Controller('vendors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorsController {
  constructor(
    private readonly vendorsService: VendorsService,
  ) {}

  @Post('apply')
  @Roles('CUSTOMER')
  apply(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ApplyVendorDto,
  ) {
    return this.vendorsService.applyForUser(
      request.user.sub,
      dto,
    );
  }

  @Get('my-application')
  @Roles('CUSTOMER')
  getMyApplication(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.vendorsService.getMyApplication(
      request.user.sub,
    );
  }

  @Get('admin/applications')
  @Roles('ADMIN')
  getApplications() {
    return this.vendorsService.getApplications();
  }

  @Patch('admin/applications/:id/approve')
  @Roles('ADMIN')
  approveApplication(
    @Param('id') id: string,
  ) {
    return this.vendorsService.approveApplication(id);
  }

  @Patch('admin/applications/:id/reject')
  @Roles('ADMIN')
  rejectApplication(
    @Param('id') id: string,
    @Body() dto: RejectVendorApplicationDto,
  ) {
    return this.vendorsService.rejectApplication(
      id,
      dto.reason,
    );
  }
}

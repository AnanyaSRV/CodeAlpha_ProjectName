
import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { VerifyPaymentDto } from './dto/verify-payment.dto.js';
import { PaymentsService } from './payments.service.js';

interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    email: string;
    role: 'CUSTOMER' | 'VENDOR' | 'DELIVERY' | 'ADMIN';
  };
}

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get('config')
  getPaymentConfig() {
    return this.paymentsService.getPaymentConfig();
  }

  @Post('create-order/:orderId')
  createOrder(
    @Req() request: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentsService.createRazorpayOrder(
      request.user.sub,
      orderId,
    );
  }

  @Post('verify')
  verifyPayment(
    @Req() request: AuthenticatedRequest,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.paymentsService.verifyPayment(
      request.user.sub,
      dto,
    );
  }
}

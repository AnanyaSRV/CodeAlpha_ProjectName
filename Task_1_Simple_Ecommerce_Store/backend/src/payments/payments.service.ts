
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import Razorpay from 'razorpay';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma.service.js';
import { VerifyPaymentDto } from './dto/verify-payment.dto.js';

@Injectable()
export class PaymentsService {
  private readonly razorpay: Razorpay;
  private readonly keyId: string;
  private readonly keySecret: string;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.keyId = configService.get<string>('RAZORPAY_KEY_ID') ?? '';
    this.keySecret =
      configService.get<string>('RAZORPAY_KEY_SECRET') ?? '';

    if (!this.keyId || !this.keySecret) {
      throw new Error(
        'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured.',
      );
    }

    this.razorpay = new Razorpay({
      key_id: this.keyId,
      key_secret: this.keySecret,
    });
  }

  getPaymentConfig() {
    return {
      keyId: this.keyId,
      currency: 'INR',
    };
  }

  async createRazorpayOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        customerId: userId,
      },
      select: {
        id: true,
        total: true,
        paymentStatus: true,
        razorpayOrderId: true,
        paymentExpiresAt: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (order.paymentStatus === 'PAID') {
      throw new ConflictException('This order has already been paid.');
    }

    if (order.paymentStatus !== 'PENDING') {
      throw new BadRequestException(
        'This order is not available for payment.',
      );
    }

    if (!order.paymentExpiresAt || order.paymentExpiresAt <= new Date()) {
      throw new ConflictException(
        'The payment window for this order has expired. Please place a new order.',
      );
    }

    const amountInPaise = Math.round(order.total * 100);

    if (
      !Number.isSafeInteger(amountInPaise) ||
      amountInPaise <= 0
    ) {
      throw new BadRequestException('Invalid order amount.');
    }

    if (order.razorpayOrderId) {
      try {
        const existingRazorpayOrder =
          await this.razorpay.orders.fetch(order.razorpayOrderId);

        if (
          existingRazorpayOrder.amount === amountInPaise &&
          existingRazorpayOrder.currency === 'INR' &&
          existingRazorpayOrder.status !== 'paid'
        ) {
          return {
            orderId: order.id,
            razorpayOrderId: existingRazorpayOrder.id,
            amount: existingRazorpayOrder.amount,
            currency: existingRazorpayOrder.currency,
            keyId: this.keyId,
          };
        }

        if (existingRazorpayOrder.status === 'paid') {
          throw new ConflictException(
            'Razorpay reports that this order is already paid. Payment verification is required.',
          );
        }
      } catch (error) {
        if (error instanceof ConflictException) {
          throw error;
        }

        throw new InternalServerErrorException(
          'Unable to retrieve the existing payment order. Please try again.',
        );
      }
    }

    let razorpayOrder;

    try {
      razorpayOrder = await this.razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: order.id.slice(0, 40),
        notes: {
          marketHubOrderId: order.id,
          customerId: userId,
        },
      });
    } catch {
      throw new InternalServerErrorException(
        'Unable to create a Razorpay order. Please try again.',
      );
    }

    try {
      const updated = await this.prisma.order.updateMany({
        where: {
          id: order.id,
          customerId: userId,
          paymentStatus: 'PENDING',
          paymentExpiresAt: {
            gt: new Date(),
          },
          razorpayOrderId: order.razorpayOrderId,
        },
        data: {
          razorpayOrderId: razorpayOrder.id,
        },
      });

      if (updated.count !== 1) {
        const latestOrder = await this.prisma.order.findUnique({
          where: { id: order.id },
          select: {
            paymentStatus: true,
            razorpayOrderId: true,
            paymentExpiresAt: true,
          },
        });

        if (latestOrder?.paymentStatus === 'PAID') {
          throw new ConflictException(
            'This order has already been paid.',
          );
        }

        if (
          !latestOrder?.paymentExpiresAt ||
          latestOrder.paymentExpiresAt <= new Date()
        ) {
          throw new ConflictException(
            'The payment window has expired. Please place a new order.',
          );
        }

        if (latestOrder?.razorpayOrderId) {
          return {
            orderId: order.id,
            razorpayOrderId: latestOrder.razorpayOrderId,
            amount: amountInPaise,
            currency: 'INR',
            keyId: this.keyId,
          };
        }

        throw new ConflictException(
          'The order changed while payment was being initialized. Please try again.',
        );
      }
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Payment order was created but could not be saved. Please contact support before retrying.',
      );
    }

    return {
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: this.keyId,
    };
  }

  async verifyPayment(userId: string, dto: VerifyPaymentDto) {
    const order = await this.prisma.order.findFirst({
      where: {
        razorpayOrderId: dto.razorpay_order_id,
        customerId: userId,
      },
      select: {
        id: true,
        total: true,
        paymentStatus: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        paymentExpiresAt: true,
      },
    });

    if (!order || !order.razorpayOrderId) {
      throw new NotFoundException(
        'Payment order was not found for this customer.',
      );
    }

    if (order.paymentStatus === 'PAID') {
      if (order.razorpayPaymentId === dto.razorpay_payment_id) {
        return {
          success: true,
          message: 'Payment has already been verified.',
          orderId: order.id,
          paymentStatus: 'PAID',
        };
      }

      throw new ConflictException(
        'A different payment has already been recorded for this order.',
      );
    }

    if (order.paymentStatus !== 'PENDING') {
      throw new BadRequestException(
        'This order is not available for payment verification.',
      );
    }

    if (!order.paymentExpiresAt || order.paymentExpiresAt <= new Date()) {
      throw new ConflictException(
        'The payment window has expired. This order cannot be paid through checkout.',
      );
    }

    const expectedSignature = createHmac('sha256', this.keySecret)
      .update(
        `${dto.razorpay_order_id}|${dto.razorpay_payment_id}`,
      )
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const receivedBuffer = Buffer.from(
      dto.razorpay_signature,
      'hex',
    );

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new UnauthorizedException(
        'Payment signature verification failed.',
      );
    }

    let payment;

    try {
      payment = await this.razorpay.payments.fetch(
        dto.razorpay_payment_id,
      );
    } catch {
      throw new BadRequestException(
        'Unable to verify the payment with Razorpay. Please try again.',
      );
    }

    const expectedAmount = Math.round(order.total * 100);

    if (
      payment.order_id !== order.razorpayOrderId ||
      payment.amount !== expectedAmount ||
      payment.currency !== 'INR'
    ) {
      throw new UnauthorizedException(
        'Payment details do not match this order.',
      );
    }

    const latestOrder = await this.prisma.order.findUnique({
      where: { id: order.id },
      select: {
        paymentStatus: true,
        paymentExpiresAt: true,
      },
    });

    if (
      !latestOrder ||
      latestOrder.paymentStatus !== 'PENDING' ||
      !latestOrder.paymentExpiresAt ||
      latestOrder.paymentExpiresAt <= new Date()
    ) {
      throw new ConflictException(
        'The order has expired or its payment status has changed.',
      );
    }

    if (payment.status === 'authorized') {
      try {
        payment = await this.razorpay.payments.capture(
          payment.id,
          expectedAmount,
          'INR',
        );
      } catch {
        throw new BadRequestException(
          'Payment is authorized but could not be captured. Please contact support if money was deducted.',
        );
      }
    }

    if (payment.status !== 'captured' || !payment.captured) {
      throw new BadRequestException(
        'Payment has not been captured successfully.',
      );
    }

    try {
      const updated = await this.prisma.order.updateMany({
        where: {
          id: order.id,
          customerId: userId,
          paymentStatus: 'PENDING',
          status: 'PENDING',
          razorpayOrderId: dto.razorpay_order_id,
          paymentExpiresAt: {
            gt: new Date(),
          },
          OR: [
            { razorpayPaymentId: null },
            { razorpayPaymentId: dto.razorpay_payment_id },
          ],
        },
        data: {
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
          razorpayPaymentId: dto.razorpay_payment_id,
          paidAt: new Date(),
        },
      });

      if (updated.count !== 1) {
        const latestOrder = await this.prisma.order.findUnique({
          where: { id: order.id },
          select: {
            paymentStatus: true,
            razorpayPaymentId: true,
          },
        });

        if (
          latestOrder?.paymentStatus === 'PAID' &&
          latestOrder.razorpayPaymentId === dto.razorpay_payment_id
        ) {
          return {
            success: true,
            message: 'Payment has already been verified.',
            orderId: order.id,
            paymentStatus: 'PAID',
          };
        }

        throw new ConflictException(
          'Order payment status changed or the payment window expired. Please contact support if money was deducted.',
        );
      }
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This payment has already been associated with another order.',
        );
      }

      throw new InternalServerErrorException(
        'Payment was captured but the order could not be updated. Please contact support with your payment reference.',
      );
    }

    return {
      success: true,
      message: 'Payment verified successfully.',
      orderId: order.id,
      paymentStatus: 'PAID',
    };
  }
}

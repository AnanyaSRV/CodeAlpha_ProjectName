import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async getAssignedOrders(deliveryPartnerId: string) {
    return this.prisma.order.findMany({
      where: {
        deliveryPartnerId,
        status: {
          in: ['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'],
        },
      },
      include: {
        customer: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
      },
      orderBy: { deliveryAssignedAt: 'desc' },
    });
  }

  async updateDeliveryStatus(
    deliveryPartnerId: string,
    orderId: string,
    requestedStatus: 'OUT_FOR_DELIVERY' | 'DELIVERED',
  ) {
    if (
      requestedStatus !== 'OUT_FOR_DELIVERY' &&
      requestedStatus !== 'DELIVERED'
    ) {
      throw new BadRequestException('Invalid delivery status.');
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          deliveryPartnerId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!order) {
        const existingOrder = await tx.order.findUnique({
          where: { id: orderId },
          select: { id: true },
        });

        if (!existingOrder) {
          throw new NotFoundException('Order not found.');
        }

        throw new ForbiddenException(
          'This order is not assigned to your delivery account.',
        );
      }

      if (order.status === requestedStatus) {
        return {
          message: 'Delivery status is already set to that value.',
          orderId,
          status: order.status,
        };
      }

      if (
        requestedStatus === 'OUT_FOR_DELIVERY' &&
        order.status !== 'SHIPPED'
      ) {
        throw new BadRequestException(
          'Only shipped orders can be marked out for delivery.',
        );
      }

      if (
        requestedStatus === 'DELIVERED' &&
        order.status !== 'OUT_FOR_DELIVERY'
      ) {
        throw new BadRequestException(
          'Only orders out for delivery can be marked delivered.',
        );
      }

      const now = new Date();

      const updated = await tx.order.updateMany({
        where: {
          id: orderId,
          deliveryPartnerId,
          status: order.status,
        },
        data: {
          status: requestedStatus,
          ...(requestedStatus === 'OUT_FOR_DELIVERY'
            ? { pickedUpAt: now }
            : { deliveredAt: now }),
        },
      });

      if (updated.count !== 1) {
        throw new BadRequestException(
          'The order status changed concurrently. Refresh and try again.',
        );
      }

      if (requestedStatus === 'DELIVERED') {
        await tx.orderItem.updateMany({
          where: {
            orderId,
            fulfillmentStatus: 'SHIPPED',
          },
          data: {
            fulfillmentStatus: 'DELIVERED',
          },
        });
      }

      return {
        message: 'Delivery status updated successfully.',
        orderId,
        status: requestedStatus,
      };
    });
  }
}
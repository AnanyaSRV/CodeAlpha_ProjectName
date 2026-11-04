import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class AdminDeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async getDeliveryPartners() {
    return this.prisma.user.findMany({
      where: { role: 'DELIVERY' },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        _count: {
          select: {
            deliveryOrders: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignDeliveryPartner(orderId: string, deliveryPartnerId: string) {
    if (!deliveryPartnerId || typeof deliveryPartnerId !== 'string') {
      throw new BadRequestException('A delivery partner is required.');
    }

    const partner = await this.prisma.user.findFirst({
      where: {
        id: deliveryPartnerId,
        role: 'DELIVERY',
      },
      select: { id: true, name: true },
    });

    if (!partner) {
      throw new NotFoundException('Delivery partner not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            select: {
              fulfillmentStatus: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found.');
      }

      if (order.paymentStatus !== 'PAID') {
        throw new BadRequestException(
          'Only paid orders can be assigned for delivery.',
        );
      }

      if (order.status === 'CANCELLED' || order.status === 'DELIVERED') {
        throw new BadRequestException(
          'This order cannot be assigned for delivery.',
        );
      }

      if (order.deliveryPartnerId) {
        throw new BadRequestException(
          'This order already has an assigned delivery partner.',
        );
      }

      if (order.items.length === 0) {
        throw new BadRequestException('This order has no items.');
      }

      const allItemsShipped = order.items.every(
        (item) => item.fulfillmentStatus === 'SHIPPED',
      );

      if (!allItemsShipped) {
        throw new BadRequestException(
          'All vendor order items must be shipped before delivery assignment.',
        );
      }

      const updated = await tx.order.updateMany({
        where: {
          id: orderId,
          deliveryPartnerId: null,
          status: { notIn: ['CANCELLED', 'DELIVERED'] },
        },
        data: {
          deliveryPartnerId: partner.id,
          deliveryAssignedAt: new Date(),
          status: 'SHIPPED',
        },
      });

      if (updated.count !== 1) {
        throw new BadRequestException(
          'The order was changed by another request. Refresh and try again.',
        );
      }

      return {
        message: 'Delivery partner assigned successfully.',
        orderId,
        deliveryPartner: partner,
      };
    });
  }
}
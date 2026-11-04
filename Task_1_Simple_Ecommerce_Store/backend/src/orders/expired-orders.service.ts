
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class ExpiredOrdersService {
  private readonly logger = new Logger(ExpiredOrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async cancelExpiredOrders() {
    const now = new Date();

    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: 'PENDING',
        paymentStatus: 'PENDING',
        paymentExpiresAt: {
          lte: now,
        },
      },
      select: {
        id: true,
      },
      take: 100,
    });

    for (const order of expiredOrders) {
      try {
        const restored = await this.prisma.$transaction(
          async (tx) => {
            const items = await tx.orderItem.findMany({
              where: {
                orderId: order.id,
              },
              select: {
                productId: true,
                quantity: true,
              },
            });

            const cancelled = await tx.order.updateMany({
              where: {
                id: order.id,
                status: 'PENDING',
                paymentStatus: 'PENDING',
                paymentExpiresAt: {
                  lte: now,
                },
              },
              data: {
                status: 'CANCELLED',
              },
            });

            if (cancelled.count !== 1) {
              return false;
            }

            for (const item of items) {
              await tx.product.update({
                where: {
                  id: item.productId,
                },
                data: {
                  stock: {
                    increment: item.quantity,
                  },
                },
              });
            }

            await tx.orderItem.updateMany({
              where: {
                orderId: order.id,
                fulfillmentStatus: {
                  not: 'CANCELLED',
                },
              },
              data: {
                fulfillmentStatus: 'CANCELLED',
              },
            });

            return true;
          },
          {
            maxWait: 10000,
            timeout: 20000,
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );

        if (restored) {
          this.logger.log(
            `Expired order ${order.id} cancelled and inventory restored.`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to process expired order ${order.id}.`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}

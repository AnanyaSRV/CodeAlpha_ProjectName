import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { VendorFulfillmentStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateFulfillmentStatusDto } from './dto/update-fulfillment-status.dto.js';

const allowedTransitions: Record<
  VendorFulfillmentStatus,
  VendorFulfillmentStatus[]
> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(customerId: string, dto: CreateOrderDto) {
    const quantities = new Map<string, number>();

    for (const item of dto.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new BadRequestException(
          'Every quantity must be a positive integer.',
        );
      }

      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity,
      );
    }

    const items = [...quantities.entries()].map(([productId, quantity]) => ({
      productId,
      quantity,
    }));

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const orderItems: {
            productId: string;
            quantity: number;
            unitPrice: number;
            commissionRate: number;
          }[] = [];

          let total = 0;

          for (const item of items) {
            const product = await tx.product.findFirst({
              where: {
                id: item.productId,
                active: true,
              },
              include: {
                vendor: {
                  select: {
                    commission: true,
                  },
                },
              },
            });

            if (!product) {
              throw new NotFoundException(
                `Product ${item.productId} was not found or is inactive.`,
              );
            }

            if (product.stock < item.quantity) {
              throw new BadRequestException(
                `Not enough stock for "${product.name}". Available: ${product.stock}.`,
              );
            }

            const updated = await tx.product.updateMany({
              where: {
                id: product.id,
                active: true,
                stock: { gte: item.quantity },
              },
              data: {
                stock: { decrement: item.quantity },
              },
            });

            if (updated.count !== 1) {
              throw new BadRequestException(
                `Stock changed for "${product.name}". Please try again.`,
              );
            }

            orderItems.push({
              productId: product.id,
              quantity: item.quantity,
              unitPrice: product.price,
              commissionRate: product.vendor.commission,
            });

            total += product.price * item.quantity;
          }

          return tx.order.create({
            data: {
              customerId,
              total: Number(total.toFixed(2)),
              shippingName: dto.shippingName.trim(),
              shippingPhone: dto.shippingPhone.trim(),
              addressLine1: dto.addressLine1.trim(),
              addressLine2: dto.addressLine2?.trim() || null,
              city: dto.city.trim(),
              state: dto.state.trim(),
              postalCode: dto.postalCode.trim(),
              contactEmail: dto.contactEmail?.trim().toLowerCase() || null,
              paymentExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
              items: {
                create: orderItems,
              },
            },
            include: {
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
          });
        },
        {
          maxWait: 10000,
          timeout: 20000,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new BadRequestException(
          'Inventory changed while placing your order. Please try again.',
        );
      }

      throw error;
    }
  }

  async getMyOrders(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        deliveryPartner: {
          select: {
            id: true,
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
    });
  }

  private async getApprovedVendor(userId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
      select: {
        id: true,
        applicationStatus: true,
      },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found.');
    }

    if (vendor.applicationStatus !== 'APPROVED') {
      throw new ForbiddenException(
        'Your vendor application must be approved before you can access vendor orders.',
      );
    }

    return vendor;
  }

  async getVendorOrders(userId: string) {
    const vendor = await this.getApprovedVendor(userId);

    const orders = await this.prisma.order.findMany({
      where: {
        items: {
          some: {
            product: {
              vendorId: vendor.id,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        items: {
          where: {
            product: {
              vendorId: vendor.id,
            },
          },
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            fulfillmentStatus: true,
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
    });

    return orders.map((order) => ({
      id: order.id,
      createdAt: order.createdAt,
      items: order.items,
      vendorSubtotal: Number(
        order.items
          .reduce(
            (sum, item) => sum + item.unitPrice * item.quantity,
            0,
          )
          .toFixed(2),
      ),
    }));
  }

  async updateVendorItemStatus(
    userId: string,
    itemId: string,
    requestedStatus: VendorFulfillmentStatus,
  ) {
    const vendor = await this.getApprovedVendor(userId);

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findFirst({
        where: {
          id: itemId,
          product: {
            vendorId: vendor.id,
          },
        },
        select: {
          id: true,
          fulfillmentStatus: true,
        },
      });

      if (!item) {
        throw new NotFoundException(
          'Order item not found in your vendor store.',
        );
      }

      if (item.fulfillmentStatus === requestedStatus) {
        return {
          message: 'Fulfillment status is already set to that value.',
          itemId: item.id,
          status: item.fulfillmentStatus,
        };
      }

      if (!allowedTransitions[item.fulfillmentStatus].includes(requestedStatus)) {
        throw new BadRequestException(
          `Cannot change fulfillment from ${item.fulfillmentStatus} to ${requestedStatus}.`,
        );
      }

      const updated = await tx.orderItem.updateMany({
        where: {
          id: item.id,
          fulfillmentStatus: item.fulfillmentStatus,
          product: {
            vendorId: vendor.id,
          },
        },
        data: {
          fulfillmentStatus: requestedStatus,
        },
      });

      if (updated.count !== 1) {
        throw new BadRequestException(
          'Fulfillment status changed concurrently. Refresh and try again.',
        );
      }

      return {
        message: 'Fulfillment status updated successfully.',
        itemId: item.id,
        status: requestedStatus,
      };
    });
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [
      totalUsers,
      totalVendors,
      totalProducts,
      activeProducts,
      totalOrders,
      paidRevenue,
      pendingOrders,
      totalDeliveryPartners,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.vendor.count({
        where: { applicationStatus: 'APPROVED' },
      }),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { active: true } }),
      this.prisma.order.count(),
      this.prisma.order.aggregate({
        where: { paymentStatus: 'PAID' },
        _sum: { total: true },
      }),
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.prisma.user.count({ where: { role: 'DELIVERY' } }),
    ]);

    return {
      totalUsers,
      totalVendors,
      totalProducts,
      activeProducts,
      totalOrders,
      pendingOrders,
      totalDeliveryPartners,
      paidRevenue: paidRevenue._sum.total ?? 0,
    };
  }

  async getUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        vendorProfile: {
          select: {
            storeName: true,
            applicationStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async promoteUserToDeliveryPartner(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.role === 'DELIVERY') {
      throw new BadRequestException(
        'This user is already a delivery partner.',
      );
    }

    if (user.role !== 'CUSTOMER') {
      throw new BadRequestException(
        'Only customer accounts can be promoted to delivery partners.',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { role: 'DELIVERY' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return {
      message: 'User successfully promoted to delivery partner.',
      user: updatedUser,
    };
  }

  async getProducts() {
    return this.prisma.product.findMany({
      include: {
        vendor: {
          select: {
            storeName: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateProductStatus(id: string, active: boolean) {
    if (typeof active !== 'boolean') {
      throw new BadRequestException('Active must be true or false.');
    }

    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    return this.prisma.product.update({
      where: { id },
      data: { active },
    });
  }

  async getOrders() {
    return this.prisma.order.findMany({
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
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
                category: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

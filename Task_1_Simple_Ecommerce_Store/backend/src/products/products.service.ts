
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    search?: string,
    page = 1,
    limit = 12,
    category?: string,
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const normalizedSearch = search?.trim();
    const normalizedCategory = category?.trim();

    const where = {
      active: true,
      ...(normalizedCategory && normalizedCategory !== 'All products'
        ? {
            category: {
              equals: normalizedCategory,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(normalizedSearch
        ? {
            OR: [
              {
                name: {
                  contains: normalizedSearch,
                  mode: 'insensitive' as const,
                },
              },
              {
                description: {
                  contains: normalizedSearch,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const orderBy = [
      { createdAt: 'desc' as const },
      { name: 'asc' as const },
      { id: 'asc' as const },
    ];

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          vendor: {
            select: { id: true, storeName: true },
          },
        },
        orderBy,
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      products,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async findCategories() {
    const results = await this.prisma.product.findMany({
      where: { active: true },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });

    return results.map((item) => item.category);
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, active: true },
      include: {
        vendor: {
          select: { id: true, storeName: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private async getVendorIdForUser(userId: string): Promise<string> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
      select: {
        id: true,
        applicationStatus: true,
      },
    });

    if (!vendor) {
      throw new ForbiddenException(
        'You do not have a vendor profile.',
      );
    }

    if (vendor.applicationStatus !== 'APPROVED') {
      throw new ForbiddenException(
        'Your vendor application must be approved before you can manage products.',
      );
    }

    return vendor.id;
  }

  async findMyProducts(userId: string) {
    const vendorId = await this.getVendorIdForUser(userId);

    return this.prisma.product.findMany({
      where: { vendorId },
      include: {
        vendor: {
          select: { id: true, storeName: true },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
        { name: 'asc' },
        { id: 'asc' },
      ],
    });
  }

  async createForVendor(userId: string, dto: CreateProductDto) {
    const vendorId = await this.getVendorIdForUser(userId);

    return this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        stock: dto.stock,
        imageUrl: dto.imageUrl,
        category: dto.category?.trim() || 'Uncategorized',
        vendorId,
      },
      include: {
        vendor: {
          select: { id: true, storeName: true },
        },
      },
    });
  }

  async updateForVendor(
    userId: string,
    productId: string,
    dto: UpdateProductDto,
  ) {
    const vendorId = await this.getVendorIdForUser(userId);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, vendorId },
    });

    if (!product) {
      throw new NotFoundException(
        'Product not found or you do not own this product',
      );
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.stock !== undefined ? { stock: dto.stock } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.category !== undefined
          ? { category: dto.category.trim() || 'Uncategorized' }
          : {}),
      },
      include: {
        vendor: {
          select: { id: true, storeName: true },
        },
      },
    });
  }

  async deactivateForVendor(userId: string, productId: string) {
    const vendorId = await this.getVendorIdForUser(userId);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, vendorId },
    });

    if (!product) {
      throw new NotFoundException(
        'Product not found or you do not own this product',
      );
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: { active: false },
    });
  }
}

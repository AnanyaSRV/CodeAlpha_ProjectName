
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { ApplyVendorDto } from './dto/apply-vendor.dto.js';

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  async applyForUser(userId: string, dto: ApplyVendorDto) {
    const storeName = dto.storeName.trim();
    const description = dto.description?.trim() || null;

    if (storeName.length < 2) {
      throw new ConflictException(
        'Store name must contain at least 2 characters.',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          include: { vendorProfile: true },
        });

        if (!user) {
          throw new NotFoundException('User not found.');
        }

        if (user.role === 'ADMIN' || user.role === 'DELIVERY') {
          throw new ConflictException(
            'This account cannot apply for vendor access.',
          );
        }

        if (user.vendorProfile) {
          if (user.vendorProfile.applicationStatus === 'APPROVED') {
            throw new ConflictException(
              'Your vendor application has already been approved.',
            );
          }

          if (user.vendorProfile.applicationStatus === 'PENDING') {
            throw new ConflictException(
              'You already have a pending vendor application.',
            );
          }

          const updatedVendor = await tx.vendor.update({
            where: { id: user.vendorProfile.id },
            data: {
              storeName,
              description,
              applicationStatus: 'PENDING',
              rejectionReason: null,
              reviewedAt: null,
            },
            select: {
              id: true,
              storeName: true,
              description: true,
              applicationStatus: true,
              rejectionReason: true,
              reviewedAt: true,
              createdAt: true,
            },
          });

          return {
            message: 'Your vendor application has been resubmitted.',
            application: updatedVendor,
          };
        }

        const vendor = await tx.vendor.create({
          data: {
            storeName,
            description,
            userId: user.id,
            applicationStatus: 'PENDING',
          },
          select: {
            id: true,
            storeName: true,
            description: true,
            applicationStatus: true,
            rejectionReason: true,
            reviewedAt: true,
            createdAt: true,
          },
        });

        return {
          message: 'Your vendor application has been submitted.',
          application: vendor,
        };
      },
      {
        maxWait: 10000,
        timeout: 20000,
      },
    );
  }

  async getMyApplication(userId: string) {
    const application = await this.prisma.vendor.findUnique({
      where: { userId },
      select: {
        id: true,
        storeName: true,
        description: true,
        applicationStatus: true,
        rejectionReason: true,
        reviewedAt: true,
        createdAt: true,
      },
    });

    return { application };
  }

  async getApplications() {
    return this.prisma.vendor.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        storeName: true,
        description: true,
        commission: true,
        applicationStatus: true,
        rejectionReason: true,
        reviewedAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async approveApplication(applicationId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const application = await tx.vendor.findUnique({
          where: { id: applicationId },
          include: {
            user: {
              select: {
                id: true,
                role: true,
              },
            },
          },
        });

        if (!application) {
          throw new NotFoundException(
            'Vendor application not found.',
          );
        }

        if (application.applicationStatus !== 'PENDING') {
          throw new ConflictException(
            `This application is already ${application.applicationStatus.toLowerCase()}.`,
          );
        }

        if (
          application.user.role === 'ADMIN' ||
          application.user.role === 'DELIVERY'
        ) {
          throw new ConflictException(
            'This account cannot be approved as a vendor.',
          );
        }

        const vendor = await tx.vendor.update({
          where: { id: applicationId },
          data: {
            applicationStatus: 'APPROVED',
            rejectionReason: null,
            reviewedAt: new Date(),
          },
          select: {
            id: true,
            storeName: true,
            applicationStatus: true,
            reviewedAt: true,
            userId: true,
          },
        });

        await tx.user.update({
          where: { id: application.user.id },
          data: { role: 'VENDOR' },
        });

        return {
          message: 'Vendor application approved successfully.',
          application: vendor,
        };
      },
      {
        maxWait: 10000,
        timeout: 20000,
      },
    );
  }

  async rejectApplication(
    applicationId: string,
    reason: string,
  ) {
    const normalizedReason = reason.trim();

    if (normalizedReason.length < 5) {
      throw new ConflictException(
        'Please provide a rejection reason of at least 5 characters.',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        const application = await tx.vendor.findUnique({
          where: { id: applicationId },
          select: {
            id: true,
            applicationStatus: true,
          },
        });

        if (!application) {
          throw new NotFoundException(
            'Vendor application not found.',
          );
        }

        if (application.applicationStatus !== 'PENDING') {
          throw new ConflictException(
            `This application is already ${application.applicationStatus.toLowerCase()}.`,
          );
        }

        const vendor = await tx.vendor.update({
          where: { id: applicationId },
          data: {
            applicationStatus: 'REJECTED',
            rejectionReason: normalizedReason,
            reviewedAt: new Date(),
          },
          select: {
            id: true,
            storeName: true,
            applicationStatus: true,
            rejectionReason: true,
            reviewedAt: true,
            userId: true,
          },
        });

        return {
          message: 'Vendor application rejected.',
          application: vendor,
        };
      },
      {
        maxWait: 10000,
        timeout: 20000,
      },
    );
  }
}

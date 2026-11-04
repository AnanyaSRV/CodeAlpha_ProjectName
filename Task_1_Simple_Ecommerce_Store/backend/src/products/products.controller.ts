
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductsService } from './products.service.js';

interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    email: string;
    role: 'CUSTOMER' | 'VENDOR' | 'DELIVERY' | 'ADMIN';
  };
}

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Public: list active products with optional search, category and pagination.
  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 12,
    @Query('category') category?: string,
  ) {
    return this.productsService.findAll(search, page, limit, category);
  }

  // Public: return the category names currently used by active products.
  // Keep this route above @Get(':id') so "categories" is not treated as an ID.
  @Get('categories')
  findCategories() {
    return this.productsService.findCategories();
  }

  // Vendor-only: list all products belonging to the authenticated vendor.
  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('VENDOR')
  findMyProducts(@Req() request: AuthenticatedRequest) {
    return this.productsService.findMyProducts(request.user.sub);
  }

  // Public: view an active product.
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  // Vendor-only: create a product for the authenticated vendor.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('VENDOR')
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.createForVendor(request.user.sub, dto);
  }

  // Vendor-only: update a product owned by the authenticated vendor.
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('VENDOR')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.updateForVendor(
      request.user.sub,
      id,
      dto,
    );
  }

  // Vendor-only: deactivate a product without deleting its history.
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('VENDOR')
  deactivate(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.productsService.deactivateForVendor(
      request.user.sub,
      id,
    );
  }
}

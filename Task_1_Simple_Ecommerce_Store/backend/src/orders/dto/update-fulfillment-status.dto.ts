
import { IsEnum } from 'class-validator';

export enum VendorFulfillmentStatusInput {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export class UpdateFulfillmentStatusDto {
  @IsEnum(VendorFulfillmentStatusInput)
  status!: VendorFulfillmentStatusInput;
}

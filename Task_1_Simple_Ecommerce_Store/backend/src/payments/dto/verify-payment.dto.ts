
import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class VerifyPaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  razorpay_order_id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  razorpay_payment_id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  razorpay_signature!: string;
}

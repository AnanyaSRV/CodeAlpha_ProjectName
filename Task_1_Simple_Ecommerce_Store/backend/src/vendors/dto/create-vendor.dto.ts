
import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateVendorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  userId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  storeName!: string;

  @IsString()
  @MaxLength(1000)
  description!: string;
}


import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ApplyVendorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  storeName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

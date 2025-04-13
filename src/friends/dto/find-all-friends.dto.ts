import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class FindAllFriendsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isAccepted?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isBlocked?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  page?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  limit?: number;

  @ApiProperty({ 
    required: false, 
    description: 'Bao gồm thông tin quan hệ user và friend' 
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  includeRelations?: boolean;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsBoolean, IsEmail, ValidateIf } from 'class-validator';

export class CreateFriendsDto {
  @ApiProperty({ required: false, description: 'ID của người dùng muốn kết bạn' })
  @ValidateIf(o => !o.email)
  @IsNumber()
  friendId?: number;

  @ApiProperty({ required: false, description: 'Email của người dùng muốn kết bạn' })
  @ValidateIf(o => !o.friendId)
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;
}

import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateIf,
} from 'class-validator';

export class CreateMessagesDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  receiverId: number;

  @ApiProperty({ required: false, nullable: true })
  @ValidateIf((o) => !o.imageId)
  @IsString()
  content?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @ValidateIf((o) => !o.content)
  @IsNumber()
  imageId?: number | null;
}

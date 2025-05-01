import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SubmitChallengeDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Challenge photo file',
  })
  file: any;

  @ApiProperty({
    description: 'Optional challenge description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Challenge ID (if applicable)',
    required: false,
  })
  @IsOptional()
  @IsString()
  challengeId?: string;
} 
import { ApiProperty } from '@nestjs/swagger';
import { FileType } from '../../../../../files/domain/file';

export class FileResponseDto implements FileType {
  @ApiProperty({
    example: 'cbcfa8b8-3a25-4adb-a9c6-e325f0d0f3ae',
  })
  id: string;

  @ApiProperty({
    example: 'QmRLaT4WxUZqNJMwL4KVcdM2MRPXARKqcyEAK1Ea4ULvsz',
  })
  path: string;
} 
import { ApiProperty } from '@nestjs/swagger';

export class TodayChallengeDto {
  @ApiProperty({
    description: 'Unique identifier for the challenge',
    example: '1234-5678-90ab-cdef',
  })
  id: string;

  @ApiProperty({
    description: 'Challenge title',
    example: "Today's Challenge",
  })
  title: string;

  @ApiProperty({
    description: 'Description of the challenge',
    example: 'Chụp ảnh bánh mì đẹp nhất của bạn',
  })
  description: string;

  @ApiProperty({
    description: 'The class/category this challenge is for',
    example: 'Banh mi',
  })
  class: string;

  @ApiProperty({
    description: 'The date the challenge was created',
    example: '2023-05-01T00:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'The date the challenge expires',
    example: '2023-05-02T00:00:00.000Z',
  })
  expiresAt: string;

  @ApiProperty({
    description: 'Whether the user has completed this challenge',
    example: false,
  })
  isCompleted: boolean;

  @ApiProperty({
    description: 'Current streak count',
    example: 3,
  })
  currentStreak: number;
} 
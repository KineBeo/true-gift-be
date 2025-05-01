import { ApiProperty } from '@nestjs/swagger';

class ChallengeHistoryItem {
  @ApiProperty({
    description: 'Challenge ID',
    example: '1234-5678-90ab-cdef',
  })
  id: string;

  @ApiProperty({
    description: 'Challenge description',
    example: 'Chụp ảnh bánh mì đẹp nhất của bạn',
  })
  description: string;

  @ApiProperty({
    description: 'Challenge class/category',
    example: 'Banh mi',
  })
  class: string;

  @ApiProperty({
    description: 'Date the challenge was created',
    example: '2023-05-01T00:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Whether the challenge was completed successfully',
    example: true,
  })
  isCompleted: boolean;

  @ApiProperty({
    description: 'Date the challenge was completed (if applicable)',
    example: '2023-05-01T14:30:00.000Z',
    required: false,
  })
  completedAt?: string;

  @ApiProperty({
    description: 'Score for the submission (if completed)',
    example: 85,
    required: false,
  })
  score?: number;

  @ApiProperty({
    description: 'Photo ID or path from the submission (if completed)',
    example: 'Qm123456789abcdef',
    required: false,
  })
  photoId?: string;
}

class AchievementItem {
  @ApiProperty({
    description: 'Achievement ID',
    example: 'streak-7',
  })
  id: string;

  @ApiProperty({
    description: 'Achievement name',
    example: '7-Day Streak',
  })
  name: string;

  @ApiProperty({
    description: 'Achievement description',
    example: 'Completed challenges for 7 consecutive days',
  })
  description: string;

  @ApiProperty({
    description: 'Date the achievement was unlocked',
    example: '2023-05-07T00:00:00.000Z',
  })
  unlockedAt: string;
}

export class ChallengeHistoryDto {
  @ApiProperty({
    description: 'Current user streak count',
    example: 7,
  })
  currentStreak: number;

  @ApiProperty({
    description: 'Highest streak ever achieved',
    example: 15,
  })
  highestStreak: number;

  @ApiProperty({
    description: 'Total challenges completed',
    example: 42,
  })
  totalCompleted: number;

  @ApiProperty({
    description: 'Total challenges attempted',
    example: 50,
  })
  totalAttempted: number;

  @ApiProperty({
    description: 'List of user achievements',
    type: [AchievementItem],
  })
  achievements: AchievementItem[];

  @ApiProperty({
    description: 'History of user challenges',
    type: [ChallengeHistoryItem],
  })
  history: ChallengeHistoryItem[];
} 
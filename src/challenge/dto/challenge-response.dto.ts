import { ApiProperty } from '@nestjs/swagger';

export class ChallengeResponseDto {
  @ApiProperty({
    description: 'Whether the challenge was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Message about the challenge result',
    example: 'Congratulations! You completed the challenge.',
  })
  message: string;

  @ApiProperty({
    description: 'Score for the challenge submission (0-100)',
    example: 85,
  })
  score: number;

  @ApiProperty({
    description: "Whether the image matched the challenge's required class",
    example: true,
  })
  isMatch: boolean;

  @ApiProperty({
    description: 'The detected class in the image',
    example: 'Banh mi',
  })
  detectedClass: string;

  @ApiProperty({
    description: 'Whether this submission increased the user streak',
    example: true,
  })
  streakIncreased: boolean;

  @ApiProperty({
    description: 'Current streak count',
    example: 7,
  })
  currentStreak: number;

  @ApiProperty({
    description: 'Any achievements unlocked with this submission',
    example: ['First Challenge', '7-Day Streak'],
    required: false,
  })
  unlockedAchievements?: string[];
} 
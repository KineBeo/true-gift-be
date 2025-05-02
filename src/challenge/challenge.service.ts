import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Challenge, UserStreak, Achievement } from './domain';
import { YoloService } from './services/yolo-service';
import { DeepseekService } from './services/deepseek-service';
import { UsersService } from '../users/users.service';
import * as fs from 'fs';
import * as path from 'path';
import { PhotoService } from '../files/infrastructure/uploader/photo.service';
import { ChallengeResponseDto } from './dto/challenge-response.dto';
import { TodayChallengeDto } from './dto/today-challenge.dto';
import { ChallengeHistoryDto } from './dto/challenge-history.dto';
import { Between } from 'typeorm';

@Injectable()
export class ChallengeService {
  private readonly logger = new Logger(ChallengeService.name);

  constructor(
    @InjectRepository(Challenge)
    private challengeRepository: Repository<Challenge>,
    @InjectRepository(UserStreak)
    private userStreakRepository: Repository<UserStreak>,
    @InjectRepository(Achievement)
    private achievementRepository: Repository<Achievement>,
    private yoloService: YoloService,
    private deepseekService: DeepseekService,
    private usersService: UsersService,
    private photoService: PhotoService,
  ) {}

  /**
   * Get today's challenge for a user
   * If no challenge exists for today, create one
   */
  async getTodayChallenge(userId: number): Promise<TodayChallengeDto> {
    this.logger.log(`Getting challenge for user ${userId}`);

    // Get today's date without time part (YYYY-MM-DD)
    const today = new Date();
    const todayDateOnly = today.toISOString().split('T')[0];

    this.logger.log(`Looking for challenge for date: ${todayDateOnly}`);

    try {
      // Try to find an existing challenge for this user for today using raw query
      // This is more reliable than using Between with TypeORM
      const userChallenges = await this.challengeRepository
        .createQueryBuilder('challenge')
        .where('challenge.userId = :userId', { userId })
        .andWhere('DATE(challenge.createdAt) = :today', {
          today: todayDateOnly,
        })
        .getMany();

      // If user already has a challenge for today, return the first one
      if (userChallenges && userChallenges.length > 0) {
        const userChallenge = userChallenges[0];
        this.logger.log(
          `Found existing challenge for user ${userId} for today: ${userChallenge.id}`,
        );

        // Get user streak
        const userStreak = await this.getUserStreak(userId);

        // Return the existing challenge
        return {
          id: userChallenge.id,
          title: "Today's Challenge",
          description: userChallenge.description,
          class: userChallenge.class,
          createdAt: userChallenge.createdAt.toISOString(),
          expiresAt: userChallenge.expiresAt.toISOString(),
          isCompleted: userChallenge.isCompleted,
          currentStreak: userStreak.currentStreak,
        };
      }

      // If user doesn't have a challenge, find today's global challenge
      const existingChallenges = await this.challengeRepository
        .createQueryBuilder('challenge')
        .where('DATE(challenge.createdAt) = :today', { today: todayDateOnly })
        .orderBy('challenge.createdAt', 'ASC')
        .limit(1)
        .getMany();

      let userChallenge;

      // Set tomorrow at midnight for the expiresAt
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      // If a challenge already exists for today, copy it for this user
      if (existingChallenges.length > 0) {
        const existingChallenge = existingChallenges[0];
        this.logger.log(
          `Found existing challenge in system for today: ${existingChallenge.id}, copying for user ${userId}`,
        );

        // Create a copy for this user with the same class and description
        userChallenge = this.challengeRepository.create({
          userId,
          class: existingChallenge.class,
          description: existingChallenge.description,
          isCompleted: false,
          expiresAt: tomorrow,
        });
      } else {
        // No challenge exists for today, create a new one
        this.logger.log(
          `No existing challenge found for today. Creating new challenge for user ${userId}`,
        );

        // Get a random class for today's challenge
        const randomClass = this.yoloService.getRandomClass();

        // Generate a description for the challenge
        const description = `Take your best photo of ${randomClass.name}`;

        // Create a new challenge
        userChallenge = this.challengeRepository.create({
          userId,
          class: randomClass.name,
          description,
          isCompleted: false,
          expiresAt: tomorrow,
        });
      }

      // Save the challenge
      await this.challengeRepository.save(userChallenge);

      // Get user streak
      const userStreak = await this.getUserStreak(userId);

      // Convert to DTO
      return {
        id: userChallenge.id,
        title: "Today's Challenge",
        description: userChallenge.description,
        class: userChallenge.class,
        createdAt: userChallenge.createdAt.toISOString(),
        expiresAt: userChallenge.expiresAt.toISOString(),
        isCompleted: userChallenge.isCompleted,
        currentStreak: userStreak.currentStreak,
      };
    } catch (error) {
      this.logger.error(`Error getting today's challenge: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a challenge by its ID
   */
  async getChallengeById(challengeId: string): Promise<Challenge> {
    const challenge = await this.challengeRepository.findOne({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new NotFoundException(`Challenge with ID ${challengeId} not found`);
    }

    return challenge;
  }

  /**
   * Submit a challenge photo
   */
  async submitChallenge(
    userId: number,
    photoUrl: string,
    originalFilename: string,
    challengeId?: string,
    photoId?: string,
  ): Promise<ChallengeResponseDto> {
    // Get the challenge
    const challenge = challengeId
      ? await this.challengeRepository.findOne({
          where: { id: challengeId, userId },
        })
      : await this.getTodaysChallengeForUser(userId);

    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }

    // If challenge is already completed, return existing result
    if (challenge.isCompleted) {
      return {
        success: true,
        message: 'You have already completed this challenge!',
        score: challenge.score ?? 0,
        isMatch: true,
        detectedClass: challenge.detectedClass ?? '',
        streakIncreased: false,
        currentStreak: (await this.getUserStreak(userId)).currentStreak,
        unlockedAchievements: [],
      };
    }

    // Submit the URL to YOLO for prediction
    const prediction = await this.yoloService.predictImage(photoUrl);

    // Check if the prediction matches the challenge class
    const isMatch =
      prediction.className.toLowerCase() === challenge.class.toLowerCase();
    const success = isMatch && prediction.score >= 70;

    // Update challenge with results
    challenge.isCompleted = success;
    challenge.completedAt = success ? new Date() : undefined;
    challenge.photoId = photoId || undefined;
    challenge.score = prediction.score;
    challenge.detectedClass = prediction.className;

    await this.challengeRepository.save(challenge);

    // If successful, update streak
    let streakIncreased = false;
    let unlockedAchievements: string[] = [];

    if (success) {
      const streakResult = await this.updateStreak(userId);
      streakIncreased = streakResult.streakIncreased;
      unlockedAchievements = streakResult.unlockedAchievements;
    } else {
      // If not successful, update attempt count
      await this.incrementAttemptCount(userId);
    }

    // Get current streak
    const userStreak = await this.getUserStreak(userId);

    // Return response
    return {
      success,
      message: success
        ? 'Congratulations! Your photo passed the challenge!'
        : 'The image does not match the challenge or score is too low.',
      score: prediction.score,
      isMatch,
      detectedClass: prediction.className,
      streakIncreased,
      currentStreak: userStreak.currentStreak,
      unlockedAchievements,
    };
  }

  /**
   * Submit a challenge with a pre-computed prediction
   * This allows the controller to call YOLO directly for better performance
   */
  async submitChallengeWithPrediction(
    userId: number,
    photoUrl: string,
    originalFilename: string,
    prediction: { className: string; classId: number; score: number },
    challengeId?: string,
    photoId?: string,
  ): Promise<ChallengeResponseDto> {
    // Get the challenge
    const challenge = challengeId
      ? await this.challengeRepository.findOne({
          where: { id: challengeId, userId },
        })
      : await this.getTodaysChallengeForUser(userId);

    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }

    // If challenge is already completed, return existing result
    if (challenge.isCompleted) {
      return {
        success: true,
        message: 'You have already completed this challenge!',
        score: challenge.score ?? 0,
        isMatch: true,
        detectedClass: challenge.detectedClass ?? '',
        streakIncreased: false,
        currentStreak: (await this.getUserStreak(userId)).currentStreak,
        unlockedAchievements: [],
      };
    }

    // Check if the prediction matches the challenge class
    const isMatch =
      prediction.className.toLowerCase() === challenge.class.toLowerCase();
    const success = isMatch && prediction.score >= 70;

    // Update challenge with results
    challenge.isCompleted = success;
    challenge.completedAt = success ? new Date() : undefined;
    challenge.photoId = photoId || undefined;
    challenge.score = prediction.score;
    challenge.detectedClass = prediction.className;

    await this.challengeRepository.save(challenge);

    // If successful, update streak
    let streakIncreased = false;
    let unlockedAchievements: string[] = [];

    if (success) {
      const streakResult = await this.updateStreak(userId);
      streakIncreased = streakResult.streakIncreased;
      unlockedAchievements = streakResult.unlockedAchievements;
    } else {
      // If not successful, update attempt count
      await this.incrementAttemptCount(userId);
    }

    // Get current streak
    const userStreak = await this.getUserStreak(userId);

    // Return response
    return {
      success,
      message: success
        ? 'Congratulations! Your photo passed the challenge!'
        : 'The image does not match the challenge or score is too low.',
      score: prediction.score,
      isMatch,
      detectedClass: prediction.className,
      streakIncreased,
      currentStreak: userStreak.currentStreak,
      unlockedAchievements,
    };
  }

  /**
   * Get user's challenge history, streaks, and achievements
   */
  async getChallengeHistory(userId: number): Promise<ChallengeHistoryDto> {
    // Get user streak info
    const userStreak = await this.getUserStreak(userId);

    // Get all achievements for user
    const achievements = await this.achievementRepository.find({
      where: { userId, isUnlocked: true },
    });

    // Get all challenges for user, sorted by creation date (newest first)
    const challenges = await this.challengeRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    // Convert to DTO
    return {
      currentStreak: userStreak.currentStreak,
      highestStreak: userStreak.highestStreak,
      totalCompleted: userStreak.totalCompleted,
      totalAttempted: userStreak.totalAttempted,
      achievements: achievements.map((a) => ({
        id: a.achievementCode,
        name: a.name,
        description: a.description,
        unlockedAt: a.unlockedAt?.toISOString() || '',
      })),
      history: challenges.map((c) => ({
        id: c.id,
        description: c.description,
        class: c.class,
        createdAt: c.createdAt.toISOString(),
        isCompleted: c.isCompleted,
        completedAt: c.completedAt?.toISOString(),
        score: c.score,
        photoId: c.photoId,
      })),
    };
  }

  /**
   * Get today's challenge for a user (internal helper)
   */
  private async getTodaysChallengeForUser(userId: number): Promise<Challenge> {
    // Get today's date without time part (YYYY-MM-DD)
    const today = new Date();
    const todayDateOnly = today.toISOString().split('T')[0];

    this.logger.log(
      `Looking for challenge for user ${userId} on ${todayDateOnly}`,
    );

    try {
      // Try to find an existing challenge for this user for today using raw query
      const userChallenges = await this.challengeRepository
        .createQueryBuilder('challenge')
        .where('challenge.userId = :userId', { userId })
        .andWhere('DATE(challenge.createdAt) = :today', {
          today: todayDateOnly,
        })
        .getMany();

      // If user already has a challenge for today, return the first one
      if (userChallenges && userChallenges.length > 0) {
        const userChallenge = userChallenges[0];
        this.logger.log(`Found existing user challenge: ${userChallenge.id}`);
        return userChallenge;
      }

      // If not, see if any challenge exists for today and create a copy
      const existingChallenges = await this.challengeRepository
        .createQueryBuilder('challenge')
        .where('DATE(challenge.createdAt) = :today', { today: todayDateOnly })
        .orderBy('challenge.createdAt', 'ASC')
        .limit(1)
        .getMany();

      // Set tomorrow at midnight for the expiresAt
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      // If a challenge already exists for today, copy it for this user
      if (existingChallenges.length > 0) {
        const existingChallenge = existingChallenges[0];
        this.logger.log(
          `Creating copy of existing challenge ${existingChallenge.id} for user ${userId}`,
        );

        // Create a copy for this user
        const userChallenge = this.challengeRepository.create({
          userId,
          class: existingChallenge.class,
          description: existingChallenge.description,
          isCompleted: false,
          expiresAt: tomorrow,
        });

        await this.challengeRepository.save(userChallenge);
        return userChallenge;
      }

      // If no challenge exists at all, throw not found exception
      throw new NotFoundException(
        `No challenge found for today (${todayDateOnly})`,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error getting today's challenge for user: ${error.message}`,
      );
      throw new NotFoundException(
        `Could not retrieve challenge: ${error.message}`,
      );
    }
  }

  /**
   * Get or create user streak info
   */
  private async getUserStreak(userId: number): Promise<UserStreak> {
    let streak = await this.userStreakRepository.findOne({
      where: { userId },
    });

    if (!streak) {
      streak = this.userStreakRepository.create({
        userId,
        currentStreak: 0,
        highestStreak: 0,
        totalCompleted: 0,
        totalAttempted: 0,
        lastCompletedAt: new Date(0), // Unix epoch
      });
      await this.userStreakRepository.save(streak);
    }

    return streak;
  }

  /**
   * Update user streak when challenge is completed
   */
  private async updateStreak(
    userId: number,
  ): Promise<{ streakIncreased: boolean; unlockedAchievements: string[] }> {
    // Get user streak
    const streak = await this.getUserStreak(userId);

    // Increment total completed
    streak.totalCompleted += 1;

    // Check if streak is broken
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastCompleted = new Date(streak.lastCompletedAt);
    lastCompleted.setHours(0, 0, 0, 0);

    // If last completed is today, no change
    if (lastCompleted.getTime() === today.getTime()) {
      await this.userStreakRepository.save(streak);
      return { streakIncreased: false, unlockedAchievements: [] };
    }

    let streakIncreased = false;
    const unlockedAchievements: string[] = [];

    // Check if last completed was yesterday or earlier
    if (lastCompleted.getTime() === yesterday.getTime()) {
      // Streak continues
      streak.currentStreak += 1;
      streakIncreased = true;
    } else {
      // Streak broken, reset
      streak.currentStreak = 1;
      streakIncreased = true;
    }

    // Update last completed date
    streak.lastCompletedAt = today;

    // Check if highest streak is beaten
    if (streak.currentStreak > streak.highestStreak) {
      streak.highestStreak = streak.currentStreak;
    }

    // Save streak
    await this.userStreakRepository.save(streak);

    // Check for streak achievements
    if (streak.currentStreak === 7) {
      const newAchievement = await this.unlockAchievement(
        userId,
        'streak-7',
        '7-Day Streak',
        'Completed challenges for 7 consecutive days',
      );
      if (newAchievement) {
        unlockedAchievements.push(newAchievement.name);
      }
    } else if (streak.currentStreak === 30) {
      const newAchievement = await this.unlockAchievement(
        userId,
        'streak-30',
        '30-Day Streak',
        'Completed challenges for 30 consecutive days',
      );
      if (newAchievement) {
        unlockedAchievements.push(newAchievement.name);
      }
    }

    // First completion achievement
    if (streak.totalCompleted === 1) {
      const newAchievement = await this.unlockAchievement(
        userId,
        'first-challenge',
        'First Challenge',
        'Completed your first daily challenge',
      );
      if (newAchievement) {
        unlockedAchievements.push(newAchievement.name);
      }
    }

    return { streakIncreased, unlockedAchievements };
  }

  /**
   * Increment attempt count when challenge is attempted but not completed
   */
  private async incrementAttemptCount(userId: number): Promise<void> {
    // Get user streak
    const streak = await this.getUserStreak(userId);

    // Increment total attempted
    streak.totalAttempted += 1;

    // Save streak
    await this.userStreakRepository.save(streak);
  }

  /**
   * Unlock an achievement for a user
   */
  private async unlockAchievement(
    userId: number,
    code: string,
    name: string,
    description: string,
  ): Promise<Achievement | null> {
    // Check if achievement already exists
    let achievement = await this.achievementRepository.findOne({
      where: { userId, achievementCode: code },
    });

    if (achievement) {
      // If already unlocked, return null
      if (achievement.isUnlocked) {
        return null;
      }

      // If exists but not unlocked, unlock it
      achievement.isUnlocked = true;
      achievement.unlockedAt = new Date();
      await this.achievementRepository.save(achievement);
      return achievement;
    }

    // Create new achievement
    achievement = this.achievementRepository.create({
      userId,
      achievementCode: code,
      name,
      description,
      isUnlocked: true,
      unlockedAt: new Date(),
    });

    await this.achievementRepository.save(achievement);
    return achievement;
  }
}

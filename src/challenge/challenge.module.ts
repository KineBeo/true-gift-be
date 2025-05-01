import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChallengeController } from './challenge.controller';
import { ChallengeService } from './challenge.service';
import { Challenge, UserStreak, Achievement } from './domain';
import { YoloService } from './services/yolo-service';
import { DeepseekService } from './services/deepseek-service';
import { UsersModule } from '../users/users.module';
import { PhotosModule } from '../files/infrastructure/uploader/photos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Challenge, UserStreak, Achievement]),
    UsersModule,
    PhotosModule,
  ],
  controllers: [ChallengeController],
  providers: [ChallengeService, YoloService, DeepseekService],
  exports: [ChallengeService],
})
export class ChallengeModule {}
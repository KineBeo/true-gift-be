import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { FileEntity } from '../persistence/relational/entities/file.entity';
import { UserPhotoEntity } from './entities/user-photo.entity';
import { PhotoController } from './photo.controller';
import { PhotoService } from './photo.service';
import { FriendsModule } from '../../../friends/friends.module';
import { FilesModule } from '../../files.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { memoryStorage } from 'multer';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileEntity, UserPhotoEntity]),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: configService.get('file.maxFileSize', 5 * 1024 * 1024), // Default 5MB file size limit
        },
      }),
      inject: [ConfigService],
    }),
    FriendsModule,
    FilesModule,
  ],
  controllers: [PhotoController],
  providers: [PhotoService],
  exports: [PhotoService],
})
export class PhotosModule {} 
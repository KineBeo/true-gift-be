import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesIpfsController } from './files.controller';
import { FilesIpfsService } from './files.service';
import { FileEntity } from '../../persistence/relational/entities/file.entity';
import { memoryStorage } from 'multer';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileEntity]),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          storage: memoryStorage(),
          limits: {
            fileSize: configService.get('file.maxFileSize'),
          },
        };
      },
    }),
  ],
  controllers: [FilesIpfsController],
  providers: [FilesIpfsService],
  exports: [FilesIpfsService],
})
export class FilesIpfsModule {} 
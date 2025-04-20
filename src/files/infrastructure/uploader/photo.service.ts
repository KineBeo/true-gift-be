import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Express } from 'express';
import { FileEntity } from '../persistence/relational/entities/file.entity';
import { UserPhotoEntity } from './entities/user-photo.entity';
import { FriendsService } from '../../../friends/friends.service';
import { FileRepository } from '../persistence/file.repository';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class PhotoService {
  constructor(
    @InjectRepository(FileEntity)
    private fileRepository: Repository<FileEntity>,
    @InjectRepository(UserPhotoEntity)
    private userPhotoRepository: Repository<UserPhotoEntity>,
    private friendsService: FriendsService,
    private configService: ConfigService,
    private fileRepo: FileRepository,
  ) {}

  async savePhoto(file: Express.Multer.File, userId: number): Promise<any> {
    // Check if file exists and has buffer data
    if (!file || !file.buffer) {
      throw new BadRequestException('Invalid file or empty file buffer');
    }

    // Save the file to disk
    const uploadDir = this.configService.get('file.uploadDir') || 'files/uploads';
    
    // Create absolute path for directory
    const absoluteUploadDir = path.isAbsolute(uploadDir) 
      ? uploadDir 
      : path.join(process.cwd(), uploadDir);
    
    // Ensure directory exists
    if (!fs.existsSync(absoluteUploadDir)) {
      fs.mkdirSync(absoluteUploadDir, { recursive: true });
    }
    
    // Generate unique filename
    const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname || '.jpg')}`;
    
    // Create absolute file path
    const absoluteFilePath = path.join(absoluteUploadDir, uniqueFilename);
    
    try {
      // Write the file using Buffer
      fs.writeFileSync(absoluteFilePath, file.buffer);
      
      // Log success for debugging
      console.log(`File written successfully to ${absoluteFilePath}`);
      
      // Save relative path to database for easier retrieval
      const relativeFilePath = path.join(uploadDir, uniqueFilename);
      
      // Save file record
      const fileEntity = this.fileRepository.create({
        path: relativeFilePath,
      });
      const savedFile = await this.fileRepository.save(fileEntity);
      
      // Create user photo record
      const userPhoto = this.userPhotoRepository.create({
        fileId: savedFile.id,
        userId,
        createdAt: new Date(),
      });
      const savedUserPhoto = await this.userPhotoRepository.save(userPhoto);
      
      // Return photo info with URL
      return {
        id: savedUserPhoto.id,
        fileId: savedFile.id,
        userId,
        createdAt: savedUserPhoto.createdAt,
        url: `${this.configService.get('app.backendDomain')}/api/v1/files/${savedFile.id}`,
      };
    } catch (error) {
      console.error('Error saving file:', error);
      throw new BadRequestException(`File upload failed: ${error.message}`);
    }
  }

  async getUserPhotos(userId: number, options: { page: number, limit: number }) {
    const { page, limit } = options;
    const skip = (page - 1) * limit;
    
    const [photos, total] = await this.userPhotoRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    
    const fileIds = photos.map(photo => photo.fileId);
    let files: FileEntity[] = [];
    
    if (fileIds.length > 0) {
      files = await this.fileRepository.findBy({ id: In(fileIds) });
    }
    
    const photosWithFiles = photos.map(photo => {
      const file = files.find(f => f.id === photo.fileId);
      return {
        id: photo.id,
        fileId: photo.fileId,
        userId: photo.userId,
        createdAt: photo.createdAt,
        url: file ? `${this.configService.get('app.backendDomain')}/api/v1/files/${file.id}` : null,
      };
    });
    
    return {
      data: photosWithFiles,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async getFriendPhotos(userId: number, friendId: number, options: { page: number, limit: number }) {
    // Check if they are friends
    const areFriends = await this.checkFriendship(userId, friendId);
    if (!areFriends) {
      throw new ForbiddenException('You are not friends with this user');
    }
    
    return this.getUserPhotos(friendId, options);
  }

  async getPhoto(photoId: string, userId: number) {
    const photo = await this.userPhotoRepository.findOne({
      where: { id: photoId },
    });
    
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }
    
    // If it's not the user's photo, check if they are friends
    if (photo.userId !== userId) {
      const areFriends = await this.checkFriendship(userId, photo.userId);
      if (!areFriends) {
        throw new ForbiddenException('You do not have permission to view this photo');
      }
    }
    
    const file = await this.fileRepository.findOne({
      where: { id: photo.fileId },
    });
    
    if (!file) {
      throw new NotFoundException('File not found');
    }
    
    return {
      id: photo.id,
      fileId: photo.fileId,
      userId: photo.userId,
      createdAt: photo.createdAt,
      url: `${this.configService.get('app.backendDomain')}/api/v1/files/${file.id}`,
    };
  }

  // Helper method to check if two users are friends
  private async checkFriendship(userId1: number, userId2: number): Promise<boolean> {
    try {
      // Find friendship where either user is the requester or recipient
      const friendQuery = {
        where: [
          { userId: userId1, friendId: userId2, isAccepted: true, isBlocked: false },
          { userId: userId2, friendId: userId1, isAccepted: true, isBlocked: false },
        ],
      };

      const friendRecord = await this.friendsService.findFriendship(friendQuery);
      return !!friendRecord;
    } catch (error) {
      console.error('Error checking friendship:', error);
      return false;
    }
  }
} 
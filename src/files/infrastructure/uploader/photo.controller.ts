import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Express } from 'express';
import { FilesService } from '../../files.service';
import { FileEntity } from '../persistence/relational/entities/file.entity';
import { PhotoService } from './photo.service';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

@ApiTags('Photos')
@Controller({
  path: 'photos',
  version: '1',
})
export class PhotoController {
  constructor(
    private readonly filesService: FilesService,
    private readonly photoService: PhotoService,
    private readonly configService: ConfigService,
  ) {}

  @Post('upload')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload a photo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      // Using memory storage instead of disk storage to ensure buffer is available
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    })
  )
  async uploadPhoto(@UploadedFile() file: Express.Multer.File, @Request() req) {
    console.log('Upload request received. Headers:', req.headers['content-type']);
    console.log('Request body keys:', Object.keys(req.body || {}));
    
    // Handle missing file more gracefully
    if (!file) {
      console.error('No file uploaded or file parsing failed');
      throw new BadRequestException('No file found in the upload. Please ensure a file is attached with field name "file"');
    }
    
    // Log detailed file information for debugging
    console.log('File received:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer ? `Buffer present (${file.buffer.length} bytes)` : 'No buffer',
      fieldname: file.fieldname
    });
    
    try {
      const result = await this.photoService.savePhoto(file, req.user.id);
      return result;
    } catch (error) {
      console.error('Error in photo upload controller:', error);
      
      // More descriptive error
      const message = error.message || 'Failed to save photo';
      const status = error.status || 500;
      
      throw new BadRequestException({
        message,
        details: error.stack,
        statusCode: status,
      });
    }
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my photos' })
  async getMyPhotos(@Request() req, @Query('page') page = 1, @Query('limit') limit = 10) {
    return this.photoService.getUserPhotos(req.user.id, { page, limit });
  }

  @Get('ai/user-content')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get photos for AI analysis' })
  @ApiResponse({ 
    status: 200,
    description: 'Returns photos from the user and their friends for AI analysis'
  })
  async getPhotosForAI(@Request() req, @Query('max_photos') maxPhotos = 50) {
    return this.photoService.getPhotosForAI(req.user.id, maxPhotos);
  }

  @Get('friends/:friendId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get photos from a specific friend' })
  async getFriendPhotos(
    @Param('friendId') friendId: number,
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.photoService.getFriendPhotos(req.user.id, friendId, {
      page,
      limit,
    });
  }

  @Get('friends')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get photos from all friends' })
  async getAllFriendsPhotos(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.photoService.getAllFriendsPhotos(req.user.id, {
      page,
      limit,
    });
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific photo' })
  async getPhoto(@Param('id') id: string, @Request() req) {
    return this.photoService.getPhoto(id, req.user.id);
  }
} 
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
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    
    console.log('File received:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      buffer: !!file.buffer, // Just log if buffer exists, not the entire buffer
    });
    
    return this.photoService.savePhoto(file, req.user.id);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my photos' })
  async getMyPhotos(@Request() req, @Query('page') page = 1, @Query('limit') limit = 10) {
    return this.photoService.getUserPhotos(req.user.id, { page, limit });
  }

  @Get('friends/:friendId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get photos from a friend' })
  async getFriendPhotos(
    @Request() req,
    @Param('friendId') friendId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.photoService.getFriendPhotos(req.user.id, Number(friendId), { page, limit });
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific photo' })
  async getPhoto(@Param('id') id: string, @Request() req) {
    return this.photoService.getPhoto(id, req.user.id);
  }
} 
import { Controller, Get, Post, Param, UseInterceptors, UploadedFile, Query, UseGuards, HttpStatus, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChallengeService } from './challenge.service';
import { ChallengeResponseDto } from './dto/challenge-response.dto';
import { TodayChallengeDto } from './dto/today-challenge.dto';
import { ChallengeHistoryDto } from './dto/challenge-history.dto';
import { PhotoService } from '../files/infrastructure/uploader/photo.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiBody, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
import { YoloService } from './services/yolo-service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import { Logger } from '@nestjs/common';

// Define types for debugging
interface DebugStep {
  step: string;
  status: string;
  timestamp: number;
}

interface DebugInfo {
  yoloApiUrl: string;
  processingTime: number;
  imageUrl: string;
  steps: DebugStep[];
}

// DTO để gửi Pinata URL
class SubmitChallengeUrlDto {
  photoUrl: string;
  fileName: string;
  photoId?: string;
}

@ApiTags('Challenges')
@Controller({
  path: 'challenges',
  version: '1',
})
export class ChallengeController {
  private readonly yoloApiUrl: string;
  private readonly logger: Logger;

  constructor(
    private readonly challengeService: ChallengeService,
    private readonly photoService: PhotoService,
    private readonly yoloService: YoloService,
    private readonly configService: ConfigService,
  ) {
    this.yoloApiUrl = this.configService.get<string>('YOLO_API_URL') || 'http://localhost:8000';
    this.logger = new Logger(ChallengeController.name);
  }

  @Get('today/:userId')
  @ApiOperation({ summary: 'Get today\'s challenge for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Returns today\'s challenge details', 
    type: TodayChallengeDto 
  })
  async getTodayChallenge(@Param('userId') userId: string): Promise<TodayChallengeDto> {
    this.logger.log(`[Controller] Getting today's challenge for user ${userId}`);
    const result = await this.challengeService.getTodayChallenge(parseInt(userId, 10));
    this.logger.log(`[Controller] Challenge ID: ${result.id}, Class: ${result.class}`);
    return result;
  }

  @Post('submit/:userId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Submit challenge with a photo upload', 
    description: 'Upload a photo to complete today\'s challenge'
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'challengeId', description: 'Challenge ID (optional)', required: false })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The photo file to upload'
        }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Challenge submitted successfully', 
    type: ChallengeResponseDto 
  })
  @UseInterceptors(FileInterceptor('file'))
  async submitChallenge(
    @Param('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('challengeId') challengeId?: string,
  ): Promise<ChallengeResponseDto> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      // 1. First, predict the food class directly using the file buffer
      const formData = new FormData();
      formData.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });

      // Call YOLO microservice directly
      const predictionResponse = await axios.post(`${this.yoloApiUrl}/predict`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const predictionResult = predictionResponse.data;
      
      // 2. Upload photo to Pinata via PhotoService (for storage purposes)
      const uploadResult = await this.photoService.savePhoto(file, parseInt(userId, 10));
      
      // 3. Process and validate challenge with the prediction and photo URL
      // Extract the top prediction
      let className = 'Unknown';
      let classId = -1;
      let score = 0;
      
      if (predictionResult.predictions && predictionResult.predictions.length > 0) {
        // Find the prediction with the highest score
        const topPrediction = predictionResult.predictions.reduce((prev: any, current: any) => 
          (prev.score > current.score) ? prev : current
        );
        
        // Get the class name from YoloService (which has the mapping)
        className = this.yoloService.getClassName(topPrediction.class);
        classId = topPrediction.class;
        score = topPrediction.score * 100; // Convert to percentage
      }

      // 4. Submit using the new method with our predicted class
      return this.challengeService.submitChallengeWithPrediction(
        parseInt(userId, 10),
        uploadResult.url,
        file.originalname,
        { className, classId, score },
        challengeId,
        uploadResult.id
      );
    } catch (error) {
      console.error('Error in challenge submission:', error);
      throw new BadRequestException(`Failed to process challenge: ${error.message}`);
    }
  }

  @Get('history/:userId')
  @ApiOperation({ summary: 'Get challenge history for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Returns user\'s challenge history, streaks, and achievements', 
    type: ChallengeHistoryDto 
  })
  async getChallengeHistory(@Param('userId') userId: string): Promise<ChallengeHistoryDto> {
    return this.challengeService.getChallengeHistory(parseInt(userId, 10));
  }

  @Post('test-prediction')
  @ApiOperation({ 
    summary: 'Test endpoint for image prediction', 
    description: 'Development endpoint to test YOLO prediction service'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file to analyze'
        }
      }
    }
  })
  @UseInterceptors(FileInterceptor('file'))
  async testPrediction(@UploadedFile() file: Express.Multer.File) {
    try {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }
      
      const startTime = Date.now();
      
      // Save the file temporarily via PhotoService (handles Pinata upload)
      const uploadResult = await this.photoService.savePhoto(file, 1); // Use a placeholder user ID
      
      // Use the YOLO service for prediction (will download the file from Pinata)
      const predictionResult = await this.yoloService.predictImage(uploadResult.url);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      return {
        success: true,
        message: 'Prediction completed successfully',
        result: predictionResult,
        processingTime,
        photoUrl: uploadResult.url
      };
    } catch (error) {
      console.error('Error during prediction test:', error);
      
      return {
        success: false,
        message: `Prediction failed: ${error.message}`,
        result: {
          className: 'Error',
          classId: -1,
          score: 0,
        },
        processingTime: 0
      };
    }
  }
}
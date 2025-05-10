import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
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
import { FileConfig, FileDriver } from '../../config/file-config.type';
import fileConfig from '../../config/file.config';

// Import Pinata SDK
const PinataSDK = require('@pinata/sdk');

// Add this new import for the helpers
import { isIpfsCid, toIpfsUrl } from '../../utils/ipfs.helpers';

@Injectable()
export class PhotoService {
  private pinata: any;

  constructor(
    @InjectRepository(FileEntity)
    private fileRepository: Repository<FileEntity>,
    @InjectRepository(UserPhotoEntity)
    private userPhotoRepository: Repository<UserPhotoEntity>,
    private friendsService: FriendsService,
    private configService: ConfigService,
    private fileRepo: FileRepository,
  ) {
    // Initialize Pinata if we're using IPFS
    const driver = (fileConfig() as FileConfig).driver;
    console.log(`Photo service initialized with file driver: ${driver}`);

    if (driver === FileDriver.IPFS) {
      const pinataApiKey = this.configService.get('file.pinataApiKey');
      const pinataSecretApiKey = this.configService.get(
        'file.pinataSecretApiKey',
      );

      console.log('Pinata credentials in constructor:', {
        apiKeyPresent: !!pinataApiKey && pinataApiKey.length > 0,
        secretKeyPresent: !!pinataSecretApiKey && pinataSecretApiKey.length > 0,
        gatewayUrl: this.configService.get('file.pinataGatewayUrl'),
      });

      if (pinataApiKey && pinataSecretApiKey) {
        try {
          console.log('Initializing Pinata SDK with provided credentials...');
          this.pinata = new PinataSDK(pinataApiKey, pinataSecretApiKey);

          // Test authentication immediately to confirm credentials work
          this.pinata
            .testAuthentication()
            .then(() => {
              console.log('✅ Pinata authentication successful in constructor');
            })
            .catch((err) => {
              console.error(
                '❌ Pinata authentication failed in constructor:',
                err.message,
              );
            });
        } catch (error) {
          console.error('Error initializing Pinata SDK:', error);
        }
      } else {
        console.error('❌ Missing Pinata credentials in constructor');
      }
    }
  }

  // Helper method to get the proper photo URL based on storage driver and file path
  private getPhotoUrl(fileId: string, filePath: string): string {
    // Use the common helper for IPFS
    if (
      isIpfsCid(filePath) ||
      (fileConfig() as FileConfig).driver === FileDriver.IPFS
    ) {
      // Log to aid in debugging
      // console.log(`📋 Converting IPFS path to URL: ${filePath}`);
      const url = toIpfsUrl(filePath, this.configService);
      // console.log(`🔗 Generated IPFS URL: ${url}`);
      return url;
    }

    // Handle fallback files
    if (
      filePath.startsWith('fallback-') ||
      filePath.startsWith('files/uploads/')
    ) {
      // This is a local file fallback - make sure we use the correct backend domain
      const backendDomain = this.configService.get('app.backendDomain');

      // Ensure the path has correct format
      const normalizedPath = filePath.startsWith('/')
        ? filePath.substring(1)
        : filePath;

      // Log for debugging
      console.log(`📋 Local file path detected: ${normalizedPath}`);
      console.log(`🔗 Backend domain: ${backendDomain}`);

      // Ensure we have a properly formatted URL for local files
      const fullUrl = filePath.includes(backendDomain)
        ? filePath
        : `${backendDomain}/${normalizedPath}`;

      console.log(`🔗 Generated local file URL: ${fullUrl}`);
      return fullUrl;
    }

    // For standard S3/local storage, follow original approach

    // Check if it's already a full URL
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }

    // Default URL formation for standard files
    const backendDomain = this.configService.get('app.backendDomain');

    if (filePath.startsWith('files/')) {
      return `${backendDomain}/${filePath}`;
    } else {
      return `${backendDomain}/api/v1/files/${fileId}`;
    }
  }

  // Helper method to upload to IPFS via Pinata
  private async uploadToIPFS(
    file: Express.Multer.File,
  ): Promise<{ ipfsHash: string }> {
    if (!this.pinata) {
      throw new BadRequestException(
        'Pinata client not initialized. Check your IPFS configuration.',
      );
    }

    // Create temporary file path
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(
      tempDir,
      `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname || '.tmp')}`,
    );

    try {
      // First, test if the Pinata connection is valid
      await this.pinata.testAuthentication();

      // Write the buffer to a temporary file
      fs.writeFileSync(tempFilePath, file.buffer);

      // Create a read stream from the temp file
      const readStream = fs.createReadStream(tempFilePath);

      // Prepare file metadata
      const options = {
        pinataMetadata: {
          name: `TrueGift-${file.originalname || 'untitled'}`,
          keyvalues: {
            contentType: file.mimetype || 'application/octet-stream',
            size: file.size.toString(),
            timestamp: Date.now().toString(),
          },
        },
        pinataOptions: {
          cidVersion: 1,
        },
      };

      console.log('Uploading to Pinata with options:', options);
      console.log('File details:', {
        name: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: !!file.buffer,
        tempFile: tempFilePath,
      });

      // Upload to IPFS via Pinata
      const result = await this.pinata.pinFileToIPFS(readStream, options);

      console.log('Pinata upload result:', result);

      // Return IPFS hash (CID)
      return { ipfsHash: result.IpfsHash };
    } catch (error) {
      console.error('Error uploading to IPFS:', error);
      throw new BadRequestException(
        `Failed to upload file to IPFS: ${error.message}`,
      );
    } finally {
      // Clean up: delete the temporary file
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (err) {
        console.error('Error deleting temporary file:', err);
      }
    }
  }

  async savePhoto(file: Express.Multer.File, userId: number): Promise<any> {
    // console.log('savePhoto called with file:', {
    //   originalname: file?.originalname,
    //   mimetype: file?.mimetype,
    //   size: file?.size,
    //   buffer: file?.buffer
    //     ? `Buffer present (${file.buffer.length} bytes)`
    //     : 'No buffer',
    //   fieldname: file?.fieldname,
    // });

    // Enhanced validation for file inputs
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('File buffer is missing or empty');
    }

    // Add safe defaults for common file properties that might be missing
    // This helps handle differences between mobile and web uploads
    if (!file.originalname) {
      file.originalname = `upload_${Date.now()}.jpg`;
      console.log('Setting default originalname:', file.originalname);
    }

    if (!file.mimetype) {
      file.mimetype = 'image/jpeg';
      console.log('Setting default mimetype:', file.mimetype);
    }

    try {
      const driver = (fileConfig() as FileConfig).driver;
      let fileEntity;

      // Handle IPFS upload with Pinata
      if (driver === FileDriver.IPFS) {
        try {
          // console.log('📤 Using IPFS driver for upload');

          // CRITICAL: Always re-initialize the Pinata client for each upload to ensure fresh connection
          try {
            // Get credentials directly from config service
            const pinataApiKey =
              this.configService.get('file.pinataApiKey') ||
              process.env.PINATA_API_KEY;
            const pinataSecretApiKey =
              this.configService.get('file.pinataSecretApiKey') ||
              process.env.PINATA_SECRET_API_KEY;

            // console.log('🔑 PINATA CREDENTIALS CHECK:', {
            //   apiKeyPresent: !!pinataApiKey && pinataApiKey.length > 0,
            //   secretKeyPresent:
            //     !!pinataSecretApiKey && pinataSecretApiKey.length > 0,
            //   apiKeyStart: pinataApiKey?.substring(0, 8),
            //   apiKeyLength: pinataApiKey?.length,
            //   secretKeyLength: pinataSecretApiKey?.length,
            // });

            if (!pinataApiKey || !pinataSecretApiKey) {
              console.error(
                '❌ CRITICAL ERROR: Missing Pinata API credentials',
              );
              throw new BadRequestException(
                'Missing Pinata API credentials. Please check your environment variables.',
              );
            }

            // console.log(
            //   '🔄 Reinitializing Pinata SDK with fresh credentials...',
            // );
            // Create a completely new instance for each upload
            this.pinata = new PinataSDK(pinataApiKey, pinataSecretApiKey);

            // Test authentication immediately
            // console.log('🔒 Testing Pinata authentication...');
            const authResult = await this.pinata.testAuthentication();
            // console.log('✅ Pinata authentication successful:', authResult);
          } catch (error) {
            console.error(
              '❌ CRITICAL: Pinata initialization or authentication failed:',
              error,
            );
            // Don't fall back to local storage here - this is a critical configuration error
            throw new BadRequestException(
              `Pinata configuration error: ${error.message}. Check your API keys.`,
            );
          }

          // Create temporary file to handle the upload
          // console.log('Creating temporary file...');
          const tempDir = path.join(process.cwd(), 'temp');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }

          const tempFilePath = path.join(
            tempDir,
            `temp-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname || '.jpg')}`,
          );
          // console.log('Created temp file path:', tempFilePath);

          // Upload process with better error handling
          try {
            // Write buffer to temp file
            fs.writeFileSync(tempFilePath, file.buffer);

            // Verify file was written correctly
            const fileStats = fs.statSync(tempFilePath);
            // console.log('Temp file stats:', {
            //   size: fileStats.size,
            //   exists: fs.existsSync(tempFilePath),
            //   modified: fileStats.mtime,
            // });

            if (fileStats.size === 0) {
              throw new BadRequestException(
                'Failed to write file - empty file created',
              );
            }

            // Create read stream with explicit error handling
            const readStream = fs.createReadStream(tempFilePath);

            // Handle stream errors explicitly
            readStream.on('error', (streamError) => {
              console.error(
                '❌ Stream error during Pinata upload:',
                streamError,
              );
              throw new BadRequestException(
                `File stream error: ${streamError.message}`,
              );
            });

            // Add timestamp to make file name unique
            const timestamp = Date.now();

            // More detailed metadata for better organization in Pinata
            const options = {
              pinataMetadata: {
                name: `TrueGift-${file.originalname || `photo-${timestamp}`}`,
                keyvalues: {
                  contentType: file.mimetype || 'image/jpeg',
                  size: file.size.toString(),
                  userId: userId.toString(),
                  timestamp: timestamp.toString(),
                  filename: file.originalname || `unnamed-${timestamp}.jpg`,
                  source: 'truegift-mobile',
                  uploadDate: new Date().toISOString(),
                },
              },
              pinataOptions: {
                cidVersion: 1,
              },
            };

            // console.log(
            //   '⬆️ Starting Pinata upload with these options:',
            //   JSON.stringify(options),
            // );

            // Upload to IPFS with improved error handling
            let pinataResult;
            try {
              // console.log('📤 Uploading file stream to Pinata IPFS...');

              // Execute upload with a timeout promise
              const uploadPromise = this.pinata.pinFileToIPFS(
                readStream,
                options,
              );

              // Wait for upload to complete
              pinataResult = await uploadPromise;

              console.log('✅ Pinata upload successful! Result:', pinataResult);
              console.log('🆔 IPFS CID (Content ID):', pinataResult.IpfsHash);
              console.log('📅 Timestamp:', pinataResult.Timestamp);
            } catch (pinataError) {
              console.error('❌ Pinata upload failed with error:', pinataError);

              // Provide more detailed error based on type
              if (pinataError.name === 'TimeoutError') {
                throw new BadRequestException(
                  `Pinata upload timed out. Please try again.`,
                );
              } else if (
                pinataError.message &&
                pinataError.message.includes('authentication')
              ) {
                throw new BadRequestException(
                  `Pinata authentication failed. Check your API keys.`,
                );
              } else {
                throw new BadRequestException(
                  `Pinata upload failed: ${pinataError.message}`,
                );
              }
            } finally {
              // Always close the stream to avoid resource leaks
              readStream.destroy();
            }

            // Extra validation of result
            if (!pinataResult) {
              throw new BadRequestException('Pinata upload returned no result');
            }

            if (!pinataResult.IpfsHash) {
              console.error(
                '❌ Missing IPFS hash in Pinata response:',
                pinataResult,
              );
              throw new BadRequestException(
                'Failed to upload to IPFS - no hash returned from Pinata',
              );
            }

            // Create and save file entity with just the IPFS hash as path
            fileEntity = this.fileRepository.create({
              path: pinataResult.IpfsHash, // Store only the IPFS hash in the path
            });

            await this.fileRepository.save(fileEntity);
            console.log('✅ File entity saved with IPFS hash:', fileEntity);

            // Verify the URL works by constructing it
            const gatewayUrl =
              this.configService.get('file.pinataGatewayUrl') ||
              'https://gateway.pinata.cloud/ipfs/';
            const fullUrl = gatewayUrl.endsWith('/')
              ? `${gatewayUrl}${pinataResult.IpfsHash}`
              : `${gatewayUrl}/${pinataResult.IpfsHash}`;

            console.log('🔗 File should be accessible at:', fullUrl);
          } catch (fileError) {
            console.error('❌ File processing error:', fileError);
            throw fileError;
          } finally {
            // Always clean up temp file
            try {
              if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
                console.log('🧹 Temp file cleaned up');
              }
            } catch (unlinkError) {
              console.error('Failed to clean up temp file:', unlinkError);
            }
          }
        } catch (ipfsError) {
          console.error('❌ IPFS upload critical error:', ipfsError);

          // CRITICAL FIX: Do not fall back to local storage for any Pinata-related errors
          // This ensures we fix the root cause rather than hiding it with a fallback

          // Detailed error message for troubleshooting
          console.error('❌ Upload to Pinata IPFS failed with error:', {
            message: ipfsError.message,
            stack: ipfsError.stack,
            name: ipfsError.name,
          });

          // Check specific error types to provide more helpful messages
          let errorMessage = `IPFS upload failed: ${ipfsError.message}`;

          if (
            ipfsError.message &&
            ipfsError.message.includes('invalid authentication')
          ) {
            errorMessage =
              'Pinata authentication failed. Check your API key and secret key.';
          } else if (
            ipfsError.message &&
            ipfsError.message.includes('TimeoutError')
          ) {
            errorMessage =
              'Connection to Pinata timed out. Check your network connection.';
          } else if (
            ipfsError.message &&
            ipfsError.message.includes('ECONNREFUSED')
          ) {
            errorMessage =
              'Could not connect to Pinata service. Network connection refused.';
          }

          // Throw the error to bubble up to the controller
          throw new BadRequestException(errorMessage);

          // Uncomment this code if you decide to allow fallback to local storage again
          /*
          console.log('⚠️ Falling back to local storage due to IPFS error');
          
    const uploadDir = this.configService.get('file.uploadDir') || 'files/uploads';
          const absoluteUploadDir = path.isAbsolute(uploadDir) 
            ? uploadDir 
            : path.join(process.cwd(), uploadDir);
          
          if (!fs.existsSync(absoluteUploadDir)) {
            fs.mkdirSync(absoluteUploadDir, { recursive: true });
          }
          
          const uniqueFilename = `fallback-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname || '.jpg')}`;
          const absoluteFilePath = path.join(absoluteUploadDir, uniqueFilename);
          
          fs.writeFileSync(absoluteFilePath, file.buffer);
          console.log(`⚠️ Fallback: File written to ${absoluteFilePath}`);
          
          const relativeFilePath = path.join(uploadDir, uniqueFilename);
          
          fileEntity = this.fileRepository.create({
            path: relativeFilePath,
          });
          
          await this.fileRepository.save(fileEntity);
          console.log('⚠️ Fallback: File entity saved:', fileEntity);
          */
        }
      } else {
        // For other drivers, save the file to disk (existing code)
        const uploadDir =
          this.configService.get('file.uploadDir') || 'files/uploads';
    
    // Create absolute path for directory
    const absoluteUploadDir = path.isAbsolute(uploadDir) 
      ? uploadDir 
      : path.join(process.cwd(), uploadDir);
    
    // Ensure directory exists
    if (!fs.existsSync(absoluteUploadDir)) {
      fs.mkdirSync(absoluteUploadDir, { recursive: true });
    }
    
    // Generate unique filename
        const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname || '.jpg')}`;
    
    // Create absolute file path
    const absoluteFilePath = path.join(absoluteUploadDir, uniqueFilename);
    
      // Write the file using Buffer
      fs.writeFileSync(absoluteFilePath, file.buffer);
      
      // Log success for debugging
      console.log(`File written successfully to ${absoluteFilePath}`);
      
      // Save relative path to database for easier retrieval
      const relativeFilePath = path.join(uploadDir, uniqueFilename);
      
      // Save file record
        const newFileEntity = this.fileRepository.create({
        path: relativeFilePath,
      });
        fileEntity = await this.fileRepository.save(newFileEntity);

        // Log our success
        console.log('File entity saved:', fileEntity);
      }
      
      // Create user photo record
      const userPhoto = this.userPhotoRepository.create({
        fileId: fileEntity.id,
        userId,
        createdAt: new Date(),
      });
      const savedUserPhoto = await this.userPhotoRepository.save(userPhoto);
      
      console.log('Created user photo record:', savedUserPhoto);

      // Return photo info with URL using our helper method
      const result = {
        id: savedUserPhoto.id,
        fileId: fileEntity.id,
        userId,
        createdAt: savedUserPhoto.createdAt,
        url: this.getPhotoUrl(fileEntity.id, fileEntity.path),
      };

      console.log('Returning result:', result);
      return result;
    } catch (error) {
      console.error('Error saving file:', error);
      throw new BadRequestException(`File upload failed: ${error.message}`);
    }
  }

  async getUserPhotos(
    userId: number,
    options: { page: number; limit: number },
  ) {
    const { page, limit } = options;
    const skip = (page - 1) * limit;
    
    const [photos, total] = await this.userPhotoRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    
    const fileIds = photos.map((photo) => photo.fileId);
    let files: FileEntity[] = [];
    
    if (fileIds.length > 0) {
      files = await this.fileRepository.findBy({ id: In(fileIds) });
    }
    
    const photosWithFiles = photos.map((photo) => {
      const file = files.find((f) => f.id === photo.fileId);
      return {
        id: photo.id,
        fileId: photo.fileId,
        userId: photo.userId,
        createdAt: photo.createdAt,
        url: file ? this.getPhotoUrl(file.id, file.path) : null,
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

  async getFriendPhotos(
    userId: number,
    friendId: number,
    options: { page: number; limit: number },
  ) {
    // Check if they are friends
    const areFriends = await this.checkFriendship(userId, friendId);
    if (!areFriends) {
      throw new ForbiddenException('You are not friends with this user');
    }
    
    return this.getUserPhotos(friendId, options);
  }

  /**
   * Get photos from all friends of the given user
   * @param userId User ID requesting the photos
   * @param options Pagination options
   * @returns Photos from all friends with pagination metadata
   */
  async getAllFriendsPhotos(
    userId: number,
    options: { page: number; limit: number },
  ) {
    try {
      // Get all friends of the user using the correct method from FriendsService
      const friends = await this.friendsService.findAllFriendsForConversation(userId);

      if (!friends || friends.length === 0) {
        return {
          data: [],
          meta: {
            total: 0,
            page: options.page,
            limit: options.limit,
          },
        };
      }

      // Extract friend IDs from the friendship records
      const friendIds = friends.map(friendship => 
        friendship.userId === userId ? friendship.friendId : friendship.userId
      );

      // Get usernames for each friend to include in the response
      const friendUsernames = {};
      friends.forEach(friendship => {
        const friendId = friendship.userId === userId ? friendship.friendId : friendship.userId;
        const friendUser = friendship.userId === userId ? friendship.friend : friendship.user;
        
        if (friendUser) {
          // Use a type assertion to access the properties
          const user = friendUser as any;
          const name = [user.firstName, user.lastName]
            .filter(Boolean)
            .join(' ')
            .trim();
          
          friendUsernames[friendId] = name || `Friend ${friendId}`;
        }
      });

      // Fetch photos from all friends
      const { page, limit } = options;
      const skip = (page - 1) * limit;
      
      const [photos, total] = await this.userPhotoRepository.findAndCount({
        where: { userId: In(friendIds) },
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      });
      
      if (photos.length === 0) {
        return {
          data: [],
          meta: {
            total: 0,
            page,
            limit,
          },
        };
      }

      // Get file details for all photos
      const fileIds = photos.map(photo => photo.fileId);
      const files = await this.fileRepository.findBy({ id: In(fileIds) });
      
      // Map photos with file information and friend names
      const photosWithFiles = photos.map(photo => {
        const file = files.find(f => f.id === photo.fileId);
        const userName = friendUsernames[photo.userId] || null;
        
        return {
          id: photo.id,
          fileId: photo.fileId,
          userId: photo.userId,
          userName,
          createdAt: photo.createdAt,
          url: file ? this.getPhotoUrl(file.id, file.path) : null,
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
    } catch (error) {
      console.error('Error fetching friends photos:', error);
      throw new BadRequestException(`Failed to fetch friends photos: ${error.message}`);
    }
  }

  /**
   * Get photos for AI analysis from both the user and their friends
   * @param userId User ID requesting the photos
   * @param maxPhotos Maximum number of photos to return
   * @returns Consolidated photos data suitable for AI processing
   */
  async getPhotosForAI(userId: number, maxPhotos: number = 50): Promise<any> {
    try {
      // Get user's own photos (most recent first)
      const userPhotos = await this.userPhotoRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: Math.ceil(maxPhotos / 2), // Half of max photos from user
      });
      
      // Get photos from friends
      const friends = await this.friendsService.findAllFriendsForConversation(userId);
      
      const friendIds = friends.map(friendship => 
        friendship.userId === userId ? friendship.friendId : friendship.userId
      );
      
      // Create a mapping of user IDs to names
      const userNames = {};
      
      // Get the current user's name from any friendship
      let currentUserName = `User ${userId}`;
      if (friends.length > 0) {
        const firstFriendship = friends[0];
        const currentUser = firstFriendship.userId === userId ? firstFriendship.user : firstFriendship.friend;
        if (currentUser) {
          const user = currentUser as any;
          currentUserName = [user.firstName, user.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() || currentUserName;
        }
      }
      userNames[userId] = currentUserName;
      
      // Add all friend names to the mapping
      friends.forEach(friendship => {
        const friendId = friendship.userId === userId ? friendship.friendId : friendship.userId;
        const friendUser = friendship.userId === userId ? friendship.friend : friendship.user;
        
        if (friendUser) {
          const user = friendUser as any;
          const name = [user.firstName, user.lastName]
            .filter(Boolean)
            .join(' ')
            .trim();
          
          userNames[friendId] = name || `Friend ${friendId}`;
        }
      });
      
      // Get friends' photos if there are any friends
      let friendPhotos: UserPhotoEntity[] = [];
      if (friendIds.length > 0) {
        friendPhotos = await this.userPhotoRepository.find({
          where: { userId: In(friendIds) },
          order: { createdAt: 'DESC' },
          take: Math.floor(maxPhotos / 2), // Half of max photos from friends
        });
      }
      
      // Combine all photos
      const allPhotos = [...userPhotos, ...friendPhotos];
      
      // Get file details for all photos
      const fileIds = allPhotos.map(photo => photo.fileId);
      const files = fileIds.length > 0 ? await this.fileRepository.findBy({ id: In(fileIds) }) : [];
      
      // Format the response with detailed photo information
      const processedPhotos = allPhotos.map(photo => {
        const file = files.find(f => f.id === photo.fileId);
        const userName = userNames[photo.userId] || `User ${photo.userId}`;
        
        return {
          id: photo.id,
          fileId: photo.fileId,
          userId: photo.userId,
          userName: userName, // Add user name to the response
          isOwnPhoto: photo.userId === userId,
          createdAt: photo.createdAt,
          url: file ? this.getPhotoUrl(file.id, file.path) : null,
          path: file ? file.path : null,
        };
      });
      
      return {
        userId,
        totalPhotos: processedPhotos.length,
        userPhotosCount: userPhotos.length,
        friendPhotosCount: friendPhotos.length,
        photos: processedPhotos,
      };
    } catch (error) {
      console.error('Error fetching photos for AI analysis:', error);
      throw new BadRequestException(`Failed to fetch photos for AI: ${error.message}`);
    }
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
        throw new ForbiddenException(
          'You do not have permission to view this photo',
        );
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
      url: this.getPhotoUrl(file.id, file.path),
    };
  }

  // Helper method to check if two users are friends
  private async checkFriendship(
    userId1: number,
    userId2: number,
  ): Promise<boolean> {
    try {
      // Find friendship where either user is the requester or recipient
      const friendQuery = {
        where: [
          {
            userId: userId1,
            friendId: userId2,
            isAccepted: true,
            isBlocked: false,
          },
          {
            userId: userId2,
            friendId: userId1,
            isAccepted: true,
            isBlocked: false,
          },
        ],
      };

      const friendRecord =
        await this.friendsService.findFriendship(friendQuery);
      return !!friendRecord;
    } catch (error) {
      console.error('Error checking friendship:', error);
      return false;
    }
  }
} 

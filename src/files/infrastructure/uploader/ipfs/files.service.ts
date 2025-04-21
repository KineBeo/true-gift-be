import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { FileEntity } from '../../persistence/relational/entities/file.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileType } from '../../../../files/domain/file';
import * as fs from 'fs';
import * as path from 'path';

// Import using require for Pinata SDK
const PinataSDK = require('@pinata/sdk');

@Injectable()
export class FilesIpfsService {
  private pinata: any;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
  ) {
    // Initialize Pinata client
    const pinataApiKey = this.configService.get('file.pinataApiKey');
    const pinataSecretApiKey = this.configService.get('file.pinataSecretApiKey');
    
    try {
      console.log('FilesIpfsService: Initializing Pinata SDK...');
      this.pinata = new PinataSDK(pinataApiKey, pinataSecretApiKey);
      console.log('FilesIpfsService: Pinata SDK initialized successfully');
    } catch (error) {
      console.error('FilesIpfsService: Error initializing Pinata SDK:', error);
    }
  }

  async create(file: Express.Multer.File): Promise<FileType> {
    // Create temporary file path
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname || '.tmp')}`);
    
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

      console.log('FilesIpfsService: Uploading to Pinata with options:', options);
      console.log('FilesIpfsService: File details:', {
        name: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: !!file.buffer,
        tempFile: tempFilePath
      });

      // Upload to IPFS via Pinata
      const result = await this.pinata.pinFileToIPFS(readStream, options);
      
      console.log('FilesIpfsService: Pinata upload result:', result);
      
      // Get IPFS hash (CID)
      const ipfsHash = result.IpfsHash;
      
      // Save the file entity with IPFS hash as path
      const fileEntity = this.fileRepository.create({
        id: uuid(),
        path: ipfsHash,
      });

      await this.fileRepository.save(fileEntity);

      return fileEntity;
    } catch (error) {
      console.error('Error uploading to IPFS:', error);
      throw new HttpException(
        `Failed to upload file to IPFS: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
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

  async testPinataConnection(): Promise<{ success: boolean; message: string; gateway?: string }> {
    try {
      if (!this.pinata) {
        const pinataApiKey = this.configService.get('file.pinataApiKey');
        const pinataSecretApiKey = this.configService.get('file.pinataSecretApiKey');
        
        if (!pinataApiKey || !pinataSecretApiKey) {
          return { 
            success: false, 
            message: 'Pinata credentials are missing' 
          };
        }
        
        try {
          this.pinata = new PinataSDK(pinataApiKey, pinataSecretApiKey);
        } catch (error) {
          return { 
            success: false, 
            message: `Failed to initialize Pinata SDK: ${error.message}` 
          };
        }
      }
      
      // Test authentication
      try {
        const result = await this.pinata.testAuthentication();
        console.log('Pinata authentication test result:', result);
        
        // Return gateway URL for convenience
        const gateway = this.configService.get('file.pinataGatewayUrl') || 'https://gateway.pinata.cloud/ipfs/';
        
        return { 
          success: true, 
          message: 'Successfully connected to Pinata IPFS', 
          gateway 
        };
      } catch (error) {
        return { 
          success: false, 
          message: `Authentication failed: ${error.message}` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        message: `Unexpected error: ${error.message}` 
      };
    }
  }
} 
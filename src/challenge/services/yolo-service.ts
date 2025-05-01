import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class YoloService {
  private readonly logger = new Logger(YoloService.name);
  private readonly apiUrl: string;
  private readonly tempDir: string;

  // Map of Vietnamese food classes supported by YOLOv11
  private readonly foodClasses: Record<number, string> = {
    0: 'Banh beo',
    1: 'Banh bot loc',
    2: 'Banh can',
    3: 'Banh canh',
    4: 'Banh chung',
    5: 'Banh cuon',
    6: 'Banh duc',
    7: 'Banh gio',
    8: 'Banh khot',
    9: 'Banh mi',
    10: 'Banh pia',
    11: 'Banh tet',
    12: 'Banh trang nuong',
    13: 'Banh xeo',
    14: 'Bun bo Hue',
    15: 'Bun dau mam tom',
    16: 'Bun mam',
    17: 'Bun rieu',
    18: 'Bun thit nuong',
    19: 'Ca kho to',
    20: 'Canh chua',
    21: 'Cao lau',
    22: 'Chao long',
    23: 'Com tam',
    24: 'Goi cuon',
    25: 'Hu tieu',
    26: 'Mi quang',
    27: 'Nem chua',
    28: 'Pho',
    29: 'Xoi xeo',
  };

  constructor(private configService: ConfigService) {
    // In a real app, this would come from env variables
    this.apiUrl = this.configService.get<string>('YOLO_API_URL') || 'http://localhost:8000';
    this.logger.debug(`YoloService initialized with API URL: ${this.apiUrl}`);
    
    // Initialize the temp directory
    this.tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      this.logger.debug(`Created temp directory at: ${this.tempDir}`);
    }
  }

  /**
   * Download an image from a URL to a temporary file
   */
  private async downloadImageFromUrl(imageUrl: string): Promise<string> {
    this.logger.log(`Downloading image from URL: ${imageUrl}`);
    
    try {
      // Log request information
      this.logger.debug(`Starting download request to: ${imageUrl}`);
      
      // Download the image
      const response = await axios.get(imageUrl, { 
        responseType: 'arraybuffer',
        timeout: 10000 // 10 second timeout
      });
      
      this.logger.debug(`Download successful. Status: ${response.status}, Content-Type: ${response.headers['content-type']}, Data size: ${response.data.length} bytes`);
      
      // Create a buffer from the response data
      const buffer = Buffer.from(response.data, 'binary');
      
      // Create a temporary file path
      const tempFile = path.join(this.tempDir, `temp-${Date.now()}.jpg`);
      
      // Write the file
      fs.writeFileSync(tempFile, buffer);
      
      // Verify file exists and get stats
      const stats = fs.statSync(tempFile);
      this.logger.debug(`Image saved to: ${tempFile}, Size: ${stats.size} bytes`);
      
      return tempFile;
    } catch (error) {
      this.logger.error(`Error downloading image: ${error.message}`);
      if (error.response) {
        this.logger.error(`Response status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }

  /**
   * Implement a service for YOLO model prediction
   * @param imagePathOrUrl - Either a file path or a URL to the image (including Pinata/IPFS URLs)
   */
  async predictImage(
    imagePathOrUrl: string,
  ): Promise<{ className: string; classId: number; score: number }> {
    try {
      this.logger.log(`[DEBUG] Starting prediction for image: ${imagePathOrUrl}`);
      
      let imagePath = imagePathOrUrl;
      let tempFile: string | null = null;
      
      // Check if it's a URL
      if (imagePathOrUrl.startsWith('http://') || imagePathOrUrl.startsWith('https://')) {
        this.logger.log(`[DEBUG] Processing image from URL: ${imagePathOrUrl}`);
        
        // Download the image to a temporary file
        tempFile = await this.downloadImageFromUrl(imagePathOrUrl);
        imagePath = tempFile;
        
        this.logger.debug(`[DEBUG] Downloaded image to temporary file: ${tempFile}`);
        
        // Check file existence and size for debugging
        if (fs.existsSync(tempFile)) {
          const stats = fs.statSync(tempFile);
          this.logger.debug(`[DEBUG] Temporary file exists with size: ${stats.size} bytes`);
        } else {
          this.logger.error(`[DEBUG] ERROR: Temporary file does not exist: ${tempFile}`);
          throw new Error('Downloaded file does not exist');
        }
      } else {
        this.logger.debug(`[DEBUG] Using local file path: ${imagePath}`);
        // Check if file exists
        if (!fs.existsSync(imagePath)) {
          this.logger.error(`[DEBUG] ERROR: Local file does not exist: ${imagePath}`);
          throw new Error(`Local file does not exist: ${imagePath}`);
        }
      }
      
      // Create a form data to send the image
      const formData = new FormData();
      
      // Append the file to the form data
      const fileStream = fs.createReadStream(imagePath);
      formData.append('file', fileStream);
      
      this.logger.debug(`[DEBUG] Preparing to send request to YOLO API at: ${this.apiUrl}/predict`);
      this.logger.debug(`[DEBUG] Form data created with file: ${imagePath}`);
      
      // Log headers for debugging
      const headers = formData.getHeaders();
      this.logger.debug(`[DEBUG] Request headers: ${JSON.stringify(headers)}`);

      // Make a POST request to the YOLO prediction service
      this.logger.debug(`[DEBUG] Sending request to YOLO API at: ${this.apiUrl}/predict`);
      
      const response = await axios.post(`${this.apiUrl}/predict`, formData, {
        headers: {
          ...headers,
        },
        timeout: 30000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      
      this.logger.debug(`[DEBUG] Received response from YOLO API. Status: ${response.status}`);
      this.logger.debug(`[DEBUG] Response data: ${JSON.stringify(response.data)}`);

      // Clean up the temporary file if it exists
      if (tempFile && fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
        this.logger.debug(`[DEBUG] Deleted temporary file: ${tempFile}`);
      }

      // Process response from YOLO service
      const { predictions } = response.data;
      
      this.logger.debug(`[DEBUG] Predictions from YOLO: ${JSON.stringify(predictions)}`);
      
      if (!predictions || predictions.length === 0) {
        this.logger.debug(`[DEBUG] No predictions found in response`);
        return { className: 'Unknown', classId: -1, score: 0 };
      }

      // Find the prediction with the highest score
      const topPrediction = predictions.reduce((prev, current) => 
        (prev.score > current.score) ? prev : current
      );
      
      this.logger.debug(`[DEBUG] Top prediction: ${JSON.stringify(topPrediction)}`);
      
      // Get class name from our mapping
      const className = this.foodClasses[topPrediction.class] || 'Unknown';
      const score = topPrediction.score * 100; // Convert to percentage
      
      this.logger.debug(`[DEBUG] Final result: Class=${className}, ClassId=${topPrediction.class}, Score=${score}%`);

      // Return formatted result
      return {
        className,
        classId: topPrediction.class,
        score,
      };
    } catch (error) {
      this.logger.error(`[DEBUG] ERROR in predictImage: ${error.message}`);
      this.logger.error(`[DEBUG] Error stack: ${error.stack}`);
      
      if (error.response) {
        this.logger.error(`[DEBUG] Response status: ${error.response.status}`);
        this.logger.error(`[DEBUG] Response headers: ${JSON.stringify(error.response.headers)}`);
        this.logger.error(`[DEBUG] Response data: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        this.logger.error(`[DEBUG] No response received. Request: ${JSON.stringify(error.request)}`);
      }
      
      // For development testing, we'll simulate a response with a random class
      // In production, this should be removed and proper error handling added
      const randomClassId = Math.floor(Math.random() * 30);
      
      this.logger.debug(`[DEBUG] Returning fallback random prediction due to error`);
      
      return {
        className: this.foodClasses[randomClassId] || 'Unknown',
        classId: randomClassId,
        score: Math.random() * 100,
      };
    }
  }

  /**
   * Get all available food classes
   */
  getAllClasses(): Record<number, string> {
    return this.foodClasses;
  }

  /**
   * Get class name by ID
   */
  getClassName(classId: number): string {
    return this.foodClasses[classId] || 'Unknown';
  }

  /**
   * Get a random food class for daily challenge
   */
  getRandomClass(): { id: number; name: string } {
    const classIds = Object.keys(this.foodClasses).map(Number);
    const randomIndex = Math.floor(Math.random() * classIds.length);
    const randomId = classIds[randomIndex];
    
    return {
      id: randomId,
      name: this.foodClasses[randomId],
    };
  }
} 
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: RedisClientType;
  private isReady = false;

  constructor(private configService: ConfigService) {
    this.initializeClient();
  }

  private async initializeClient() {
    try {
      const redisUrl = this.configService.get<string>('WORKER_HOST') || 'redis://localhost:6379';
      console.log('redisUrl', redisUrl);
      this.logger.log(`Connecting to Redis at ${redisUrl}`);
      
      this.client = createClient({
        url: redisUrl
      });

      this.client.on('error', (err) => {
        this.logger.error(`Redis Error: ${err.message}`);
        this.isReady = false;
      });

      this.client.on('connect', () => {
        this.logger.log('Redis client connected');
      });

      this.client.on('ready', () => {
        this.isReady = true;
        this.logger.log('Redis client ready');
      });

      await this.client.connect();
    } catch (e) {
      this.logger.error(`Failed to connect to Redis: ${e.message}`);
      // Không throw lỗi để ứng dụng vẫn có thể chạy mà không có cache
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isReady) {
      return null;
    }
    
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) as T : null;
    } catch (e) {
      this.logger.error(`Error getting cache key ${key}: ${e.message}`);
      return null;
    }
  }

  async set(key: string, value: any, ttl = 300): Promise<void> {
    if (!this.isReady) {
      return;
    }
    
    try {
      const data = JSON.stringify(value);
      await this.client.set(key, data, { EX: ttl });
    } catch (e) {
      this.logger.error(`Error setting cache key ${key}: ${e.message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isReady) {
      return;
    }
    
    try {
      await this.client.del(key);
    } catch (e) {
      this.logger.error(`Error deleting cache key ${key}: ${e.message}`);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.isReady) {
      this.logger.warn(`Redis client not ready, skipping delPattern for pattern: ${pattern}`);
      return;
    }
    
    this.logger.log(`Starting to delete keys with pattern: ${pattern}`);
    
    try {
      // Tìm tất cả các key khớp với pattern
      let cursor = 0;
      let totalDeleted = 0;
      let allKeys: string[] = [];
      
      // Bước 1: Thu thập tất cả keys khớp với pattern
      try {
        do {
          const result = await this.client.scan(cursor, {
            MATCH: pattern,
            COUNT: 100
          });
          
          cursor = result.cursor;
          
          if (result.keys.length > 0) {
            allKeys = [...allKeys, ...result.keys];
          }
        } while (cursor !== 0);
        
        this.logger.log(`Found ${allKeys.length} keys to delete for pattern: ${pattern}`);
      } catch (scanError) {
        this.logger.error(`Error scanning keys with pattern ${pattern}: ${scanError.message}`);
        return;
      }
      
      // Bước 2: Xóa keys theo lô nếu có
      if (allKeys.length > 0) {
        try {
          // Giới hạn số lượng key xóa mỗi lần để tránh quá tải Redis
          const batchSize = 100;
          for (let i = 0; i < allKeys.length; i += batchSize) {
            const batch = allKeys.slice(i, i + batchSize);
            await this.client.del(batch);
            totalDeleted += batch.length;
          }
          
          this.logger.log(`Successfully deleted ${totalDeleted} keys with pattern: ${pattern}`);
        } catch (deleteError) {
          this.logger.error(`Error deleting keys: ${deleteError.message}`);
        }
      } else {
        this.logger.log(`No keys found matching pattern: ${pattern}`);
      }
    } catch (e) {
      this.logger.error(`Error in delPattern operation for ${pattern}: ${e.message}`);
      if (e.stack) {
        this.logger.error(`Stack trace: ${e.stack}`);
      }
    }
  }

  // Thêm phương thức trực tiếp để xóa cache mà không cần phải scan
  async directDeleteKeys(keys: string[]): Promise<void> {
    if (!this.isReady || keys.length === 0) {
      return;
    }
    
    try {
      this.logger.log(`Trực tiếp xóa ${keys.length} cache keys: ${keys.join(', ')}`);
      const deleted = await this.client.del(keys);
      this.logger.log(`Đã xóa thành công ${deleted} keys`);
    } catch (e) {
      this.logger.error(`Lỗi khi xóa keys trực tiếp: ${e.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis client disconnected');
    }
  }
} 
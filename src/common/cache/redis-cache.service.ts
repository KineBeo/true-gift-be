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
      return;
    }
    
    try {
      // Tìm tất cả các key khớp với pattern
      let cursor = 0;
      do {
        const result = await this.client.scan(cursor, {
          MATCH: pattern,
          COUNT: 100
        });
        
        cursor = result.cursor;
        
        // Xóa các key đã tìm thấy
        if (result.keys.length > 0) {
          await this.client.del(result.keys);
          this.logger.debug(`Deleted ${result.keys.length} keys with pattern: ${pattern}`);
        }
      } while (cursor !== 0);
    } catch (e) {
      this.logger.error(`Error deleting keys with pattern ${pattern}: ${e.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis client disconnected');
    }
  }
} 
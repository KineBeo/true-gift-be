import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INestApplicationContext } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private readonly configService: ConfigService;
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(private app: INestApplicationContext) {
    super(app);
    this.configService = this.app.get(ConfigService);
  }

  async connectToRedis(): Promise<void> {
    try {
      // Thử nhiều URL Redis khác nhau để đảm bảo kết nối trong mọi môi trường
      const redisUrls = [
        process.env.WORKER_HOST, // Sử dụng biến môi trường nếu có
        'redis://redis:6379',    // URL trong Docker Compose network
        'redis://localhost:6379' // URL cho local development
      ];
      
      // Lọc các URL không hợp lệ
      const validRedisUrls = redisUrls.filter(url => url) as string[];
      
      let connectedUrl: string | null = null;
      let pubClient: any = null;
      let subClient: any = null;
      let lastError: Error | null = null;

      // Thử kết nối với từng URL cho đến khi thành công
      for (const redisUrl of validRedisUrls) {
        try {
          this.logger.log(`Trying to connect to Redis at ${redisUrl}`);
          
          const tempPubClient = createClient({ url: redisUrl });
          const tempSubClient = tempPubClient.duplicate();
          
          // Xử lý lỗi
          tempPubClient.on('error', (err) => {
            this.logger.error(`Redis pub client error: ${err.message}`);
          });
          
          tempSubClient.on('error', (err) => {
            this.logger.error(`Redis sub client error: ${err.message}`);
          });
          
          // Thử kết nối
          await Promise.all([tempPubClient.connect(), tempSubClient.connect()]);
          
          // Nếu kết nối thành công, lưu URL đã kết nối và thoát vòng lặp
          pubClient = tempPubClient;
          subClient = tempSubClient;
          connectedUrl = redisUrl;
          this.logger.log(`Successfully connected to Redis at ${redisUrl}`);
          break;
        } catch (error: any) {
          this.logger.warn(`Failed to connect to Redis at ${redisUrl}: ${error.message}`);
          lastError = error;
          
          // Tiếp tục thử URL tiếp theo
        }
      }
      
      // Nếu không thể kết nối đến bất kỳ URL nào
      if (!connectedUrl || !pubClient || !subClient) {
        throw new Error(`Could not connect to any Redis instance. Last error: ${lastError?.message}`);
      }
      
      // Tạo adapter nếu kết nối thành công
      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('Redis adapter created successfully');
    } catch (error: any) {
      this.logger.error(`Failed to connect to Redis: ${error.message}`);
      throw error;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    
    // Chỉ thiết lập adapter nếu đã kết nối Redis thành công
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
      this.logger.log('Redis adapter applied to server');
    } else {
      this.logger.warn('Redis adapter not available, using default adapter');
    }
    
    return server;
  }
} 
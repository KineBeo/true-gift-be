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
      // Lấy URL Redis từ biến môi trường hoặc sử dụng giá trị mặc định
      const redisUrl = this.configService.get<string>('WORKER_HOST') || 'redis://localhost:6379';
      this.logger.log(`Connecting to Redis at ${redisUrl}`);
      
      // Tạo Redis clients
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();
      
      // Xử lý lỗi kết nối Redis
      pubClient.on('error', (err) => {
        this.logger.error(`Redis pub client error: ${err.message}`);
      });
      
      subClient.on('error', (err) => {
        this.logger.error(`Redis sub client error: ${err.message}`);
      });
      
      // Kết nối tới Redis
      await Promise.all([pubClient.connect(), subClient.connect()]);
      
      // Tạo adapter constructor để sử dụng sau
      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('Redis adapter created successfully');
    } catch (error: any) {
      this.logger.error(`Failed to connect to Redis: ${error.message}`);
      throw error;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
      this.logger.log('Redis adapter applied to server');
    }
    
    return server;
  }
}
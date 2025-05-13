import { WebSocketGateway, SubscribeMessage, MessageBody, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, WsException } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CreateMessagesDto } from './dto/create-messages.dto';
import { MessagesService } from './messages.service';
import { Logger } from '@nestjs/common';
import { RedisCacheService } from '../common/cache/redis-cache.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: true,
  namespace: 'messages',
})
export class MessagesGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MessagesGateway.name);
  
  @WebSocketServer()
  server: Server;
  
  constructor(
    private readonly messagesService: MessagesService,
    private cacheService: RedisCacheService,
    private configService: ConfigService,
    private jwtService: JwtService
  ) {}
  
  afterInit() {
    this.logger.log('WebSocket Server initialized');
  }
  
  handleConnection(client: Socket) {
    try {
      // Xác thực client khi kết nối
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
      this.logger.log(`Connection attempt with token: ${token ? `${token.substring(0, 10)}...` : 'undefined'}`);
      // this.logger.log(`client.handshake.auth`, client.handshake.auth);
      
      let userId: number;
      
      if (!token) {
        userId = client.handshake.auth.userId;
        this.logger.log(`No token provided, using userId from auth: ${userId}`);
        
        if (!userId) {
          this.logger.error('Authentication failed: No token or userId provided');
          client.emit('error', { message: 'Authentication required' });
          client.disconnect();
          return;
        }
      } else {
        try {
          // Log JWT secret và token để debug
          this.logger.log(`Attempting to verify JWT token`);
          const payload = this.jwtService.verify(token);
          userId = payload.sub || payload.id;
          this.logger.log(`JWT verification success, userId: ${userId}`);
        } catch (error) {
          this.logger.error(`JWT verification failed: ${error.message}`);
          client.emit('error', { message: 'Invalid authentication token' });
          client.disconnect();
          return;
        }
      }

      // Đăng ký client vào room dựa trên userId
      client.join(`user_${userId}`);
      client.data.userId = userId;
      
      this.logger.log(`Client connected: ${userId}`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.emit('error', { message: 'Connection error' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }
  
  @SubscribeMessage('sendMessage')
  async handleMessage(@MessageBody() data: CreateMessagesDto & { senderId?: number }, client: Socket) {
    console.log("data from client", data);
    console.log("client", client);
    try {
      // Get userId from data
      let userId = data.senderId;
      
      if (!userId) {
        this.logger.error('User ID not found in client data, handshake, or request data');
        return {
          success: false,
          error: 'Unauthorized: User ID not found'
        };
      }
      
      // Log thông tin để debug
      this.logger.log(`User ${userId} sending message to ${data.receiverId}: ${data.content}`);
      
      // Lưu tin nhắn vào database
      const message = await this.messagesService.create(userId, data);
      
      // Gửi tin nhắn tới người nhận
      this.server.to(`user_${data.receiverId}`).emit('newMessage', message);
      
      // Trả về đối tượng đơn giản
      return {
        success: true,
        message: 'Message sent successfully',
        data: message
      };
    } catch (error) {
      this.logger.error(`Error in handleMessage: ${error.message}`);
      if (error.stack) {
        this.logger.error(`Stack: ${error.stack}`);
      }
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }
  
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(@MessageBody() data: { senderId: number; readerId?: number }, client: Socket) {
    try {
      console.log("data from client", data);
      let userId = data.readerId;
      
      if (!userId) {
        this.logger.error('User ID not found in client data, handshake, or request data');
        return {
          success: false,
          error: 'Unauthorized: User ID not found'
        };
      }

      this.logger.log(`Marking messages from ${data.senderId} to ${userId} as read`);
      
      // Cập nhật trạng thái đã đọc trong database
      await this.messagesService.markAsRead(userId, data.senderId);

      // Thông báo cho người gửi
      this.server.to(`user_${data.senderId}`).emit('messagesRead', { readerId: userId });

      return {
        success: true,
        message: 'Messages marked as read'
      };
    } catch (error) {
      this.logger.error(`Error in handleMarkAsRead: ${error.message}`);
      if (error.stack) {
        this.logger.error(`Stack: ${error.stack}`);
      }
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }

  @SubscribeMessage('typing')
  handleTyping(client: Socket, payload: { receiverId: number, isTyping: boolean }) {
    const userId = client.data.userId;
    
    if (!userId) {
      return;
    }
    
    this.server.to(`user_${payload.receiverId}`).emit('userTyping', {
      userId: userId,
      isTyping: payload.isTyping
    });
  }
}
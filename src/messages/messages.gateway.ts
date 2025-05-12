import { WebSocketGateway, SubscribeMessage, MessageBody, WebSocketServer, OnGatewayInit, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CreateMessagesDto } from './dto/create-messages.dto';
import { MessagesService } from './messages.service';
import { Inject, Logger } from '@nestjs/common';
import { RedisCacheService } from '../common/cache/redis-cache.service';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: true,
  namespace: 'messages',
})
export class MessagesGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(MessagesGateway.name);
  
  @WebSocketServer()
  server: Server;
  
  constructor(
    private readonly messagesService: MessagesService,
    private cacheService: RedisCacheService,
    private configService: ConfigService,
  ) {}
  
  async afterInit(server: Server) {
    this.logger.log('WebSocket Server initialized');
  }
  
  handleConnection(client: Socket) {
    const userId = client.handshake.auth.userId;
    if (userId) {
      client.join(`user_${userId}`);
      this.logger.log(`User ${userId} connected to WebSocket`);
    } else {
      this.logger.warn('Client connected without userId in auth');
    }
  }
  
  @SubscribeMessage('sendMessage')
  async handleMessage(@MessageBody() data: CreateMessagesDto, client: Socket) {
    const userId = client.handshake.auth.userId;
    
    if (!userId) {
      this.logger.warn('Client attempted to send message without userId');
      client.emit('error', { message: 'Authentication required' });
      return;
    }
    
    try {
      // Lưu tin nhắn vào database
      this.logger.log(`User ${userId} sending message to ${data.receiverId}`);
      const message = await this.messagesService.create(userId, data);
      
      // Gửi tin nhắn tới người nhận qua WebSocket
      this.server.to(`user_${data.receiverId}`).emit('newMessage', message);
      
      // Invalidate cache cho cả người gửi và người nhận
      await this.cacheService.delPattern(`messages:conversations:${userId}*`);
      await this.cacheService.delPattern(`messages:conversations:${data.receiverId}*`);
      await this.cacheService.delPattern(`messages:thread:${userId}:${data.receiverId}*`);
      await this.cacheService.delPattern(`messages:thread:${data.receiverId}:${userId}*`);
      
      return message;
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      client.emit('error', { message: 'Failed to send message' });
    }
  }
  
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(@MessageBody() data: { senderId: number }, client: Socket) {
    const userId = client.handshake.auth.userId;
    
    if (!userId) {
      client.emit('error', { message: 'Authentication required' });
      return;
    }
    
    try {
      await this.messagesService.markAsRead(userId, data.senderId);
      
      // Thông báo cho người gửi rằng tin nhắn đã được đọc
      this.server.to(`user_${data.senderId}`).emit('messagesRead', { by: userId });
      
      // Invalidate cache
      await this.cacheService.delPattern(`messages:conversations:${userId}*`);
      await this.cacheService.delPattern(`messages:conversations:${data.senderId}*`);
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Error marking messages as read: ${error.message}`);
      client.emit('error', { message: 'Failed to mark messages as read' });
    }
  }
} 
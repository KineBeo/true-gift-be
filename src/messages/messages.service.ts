import {
  // common
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FindAllMessagesDto } from './dto/find-all-messages.dto';
import { CreateMessagesDto } from './dto/create-messages.dto';
import { UpdateMessagesDto } from './dto/update-messages.dto';
import { messagesRepository } from './infrastructure/persistence/messages.repository';
import { MessagesDto } from './dto/messages.dto';
import { FriendsService } from '../friends/friends.service';
import { RedisCacheService } from '../common/cache/redis-cache.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  
  constructor(
    private readonly messagesRepository: messagesRepository,
    private readonly friendsService: FriendsService,
    private readonly cacheService: RedisCacheService,
  ) {}

  async create(
    userId: number,
    createMessagesDto: CreateMessagesDto,
  ): Promise<MessagesDto> {
    // Kiểm tra xem người dùng có phải là bạn bè không
    const friendship = await this.friendsService.findOneWithFriendId(
      userId,
      createMessagesDto.receiverId,
    );

    // Nếu không phải bạn bè hoặc bị chặn thì không cho phép gửi tin nhắn
    if (!friendship) {
      throw new Error('Không thể gửi tin nhắn cho người này - không phải là bạn bè');
    }

    if (!friendship.isAccepted) {
      throw new Error('Không thể gửi tin nhắn cho người này - lời mời kết bạn chưa được chấp nhận');
    }

    if (friendship.isBlocked) {
      throw new Error('Không thể gửi tin nhắn cho người này - đã bị chặn');
    }

    // Tạo message object với các thuộc tính cơ bản
    const messageData: any = {
      senderId: userId,
      receiverId: createMessagesDto.receiverId,
      content: createMessagesDto.content || null,
    };
    
    // Thêm image nếu có
    if (createMessagesDto.imageId) {
      messageData.image = { id: createMessagesDto.imageId };
    }

    const message = await this.messagesRepository.create(messageData);
    
    // Invalidate cache sau khi tạo tin nhắn mới
    try {
      await this.cacheService.delPattern(`messages:conversations:${userId}*`);
      await this.cacheService.delPattern(`messages:conversations:${createMessagesDto.receiverId}*`);
      await this.cacheService.delPattern(`messages:thread:${userId}:${createMessagesDto.receiverId}*`);
      await this.cacheService.delPattern(`messages:thread:${createMessagesDto.receiverId}:${userId}*`);
      this.logger.debug('Cache invalidated after creating new message');
    } catch (error) {
      this.logger.warn(`Failed to invalidate cache: ${error.message}`);
    }
    
    return message;
  }

  async findAll(
    userId: number,
    findAllMessagesDto: FindAllMessagesDto,
  ): Promise<{ data: MessagesDto[]; meta: { total: number } }> {
    const page = findAllMessagesDto.page || 1;
    const limit = findAllMessagesDto.limit || 20;
    
    // Nếu đang tìm tin nhắn với một người cụ thể, kiểm tra cache
    if (findAllMessagesDto.receiverId) {
      const cacheKey = `messages:thread:${userId}:${findAllMessagesDto.receiverId}:${page}:${limit}`;
      try {
        const cachedMessages = await this.cacheService.get<{ data: MessagesDto[]; meta: { total: number } }>(cacheKey);
        
        if (cachedMessages) {
          this.logger.debug(`Cache hit for ${cacheKey}`);
          return cachedMessages;
        }
      } catch (error) {
        this.logger.warn(`Error getting cache: ${error.message}`);
      }
    }
    
    try {
      // Lấy tin nhắn giữa người dùng và một người khác
      let result;
      this.logger.debug(`Finding messages for user ${userId} with receiverId: ${findAllMessagesDto.receiverId}`);
      
      if (findAllMessagesDto.receiverId) {
        result = await this.messagesRepository.findAll({
          where: [
            {
              senderId: userId,
              receiverId: findAllMessagesDto.receiverId,
              isDeleted: false,
            } as any,
            {
              senderId: findAllMessagesDto.receiverId,
              receiverId: userId,
              isDeleted: false,
            } as any,
          ],
          skip: (page - 1) * limit,
          take: limit,
          order: {
            createdAt: 'ASC',
          },
        });
        
        // Cache kết quả nếu tìm thấy tin nhắn
        if (result && result.data) {
          const cacheKey = `messages:thread:${userId}:${findAllMessagesDto.receiverId}:${page}:${limit}`;
          try {
            await this.cacheService.set(cacheKey, result, 300); // Cache trong 5 phút
            this.logger.debug(`Cached message thread at ${cacheKey}`);
          } catch (error) {
            this.logger.warn(`Failed to cache message thread: ${error.message}`);
          }
        }
      } else {
        // Lấy tất cả tin nhắn của người dùng
        result = await this.messagesRepository.findAll({
          where: [
            { senderId: userId, isDeleted: false } as any,
            { receiverId: userId, isDeleted: false } as any,
          ],
          skip: (page - 1) * limit,
          take: limit,
          order: {
            createdAt: 'ASC',
          },
        });
      }
      
      // Nếu không tìm thấy tin nhắn nào, trả về mảng rỗng thay vì lỗi
      return {
        data: result?.data || [],
        meta: { 
          total: result?.total || 0 
        }
      };
    } catch (error) {
      this.logger.error(`Lỗi khi tìm tin nhắn: ${error.message}`);
      // Trả về mảng rỗng nếu có lỗi
      return {
        data: [],
        meta: { total: 0 }
      };
    }
  }

  async getConversations(
    userId: number,
    page = 1,
    limit = 10,
  ): Promise<{ data: any[]; total: number }> {
    // Kiểm tra cache
    const cacheKey = `messages:conversations:${userId}:${page}:${limit}`;
    try {
      const cachedConversations = await this.cacheService.get<{ data: any[]; total: number }>(cacheKey);
      
      if (cachedConversations) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return cachedConversations;
      }
    } catch (error) {
      this.logger.warn(`Error getting cache: ${error.message}`);
    }
    
    try {
      // Lấy danh sách người đã nhắn tin
      const { data: messages, total } = await this.messagesRepository.findAll({
        where: [
          { senderId: userId } as any,
          { receiverId: userId } as any
        ],
        relations: ['sender', 'receiver'],
        order: {
          createdAt: 'DESC',
        } as any,
      });

      // Tạo danh sách các cuộc trò chuyện duy nhất
      const conversations: {
        user: any;
        lastMessage: {
          id: string;
          content: string | null;
          createdAt: Date;
          isRead: boolean;
        };
        unreadCount?: number;
      }[] = [];
      const uniqueUsers = new Set<number>();

      // Xử lý tin nhắn để tạo cuộc trò chuyện
      for (const message of messages) {
        let otherUserId: number;
        let otherUser: any;

        if (message.senderId === userId) {
          otherUserId = message.receiverId;
          otherUser = message.receiver;
        } else {
          otherUserId = message.senderId;
          otherUser = message.sender;
        }

        // Đảm bảo otherUserId là số và otherUser hợp lệ
        if (typeof otherUserId !== 'number' || !otherUser) {
          continue;
        }

        // Kiểm tra xem đã có cuộc trò chuyện với người này chưa
        if (!uniqueUsers.has(otherUserId)) {
          uniqueUsers.add(otherUserId);
          
          // Đếm tin nhắn chưa đọc
          let unreadCount = 0;
          if (message.receiverId === userId && !message.isRead) {
            unreadCount = 1;
          }
          
          conversations.push({
            user: otherUser,
            lastMessage: {
              id: message.id,
              content: message.content,
              createdAt: message.createdAt,
              isRead: message.isRead || false,
            },
            unreadCount: unreadCount
          });
        }
      }

      // Lấy danh sách bạn bè đã được chấp nhận
      const friends = await this.friendsService.findAllFriendsForConversation(userId);
      
      // Thêm những bạn bè chưa có trong danh sách cuộc trò chuyện
      if (Array.isArray(friends)) {
        for (const friend of friends) {
          if (!friend) continue;
          
          // Xác định thông tin người bạn (nếu userId khớp với friend.user.id, thì chọn friend.friend, ngược lại chọn friend.user)
          const friendInfo = friend.user && friend.user.id === userId ? friend.friend : friend.user;
          
          // Kiểm tra friendInfo có hợp lệ không và có id là số không
          if (!friendInfo || typeof friendInfo.id !== 'number') {
            continue;
          }
          
          // Nếu chưa có trong danh sách cuộc trò chuyện
          if (!uniqueUsers.has(friendInfo.id)) {
            uniqueUsers.add(friendInfo.id);
            
            // Tạo một cuộc trò chuyện trống cho bạn bè chưa nhắn tin
            conversations.push({
              user: friendInfo,
              lastMessage: {
                id: '0',
                content: 'Hãy bắt đầu cuộc trò chuyện',
                createdAt: friend.updatedAt || friend.createdAt || new Date(),
                isRead: true
              },
              unreadCount: 0
            });
          }
        }
      }
      
      // Sắp xếp lại cuộc trò chuyện theo thời gian của tin nhắn mới nhất
      conversations.sort((a, b) => {
        const dateA = new Date(a.lastMessage.createdAt).getTime();
        const dateB = new Date(b.lastMessage.createdAt).getTime();
        return dateB - dateA;
      });

      // Giới hạn kết quả theo trang và giới hạn
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = conversations.slice(startIndex, endIndex);

      // Cache kết quả nếu tìm thấy cuộc trò chuyện
      if (paginatedData.length > 0) {
        try {
          await this.cacheService.set(cacheKey, { data: paginatedData, total: conversations.length }, 300); // Cache trong 5 phút
          this.logger.debug(`Cached conversation list at ${cacheKey}`);
        } catch (error) {
          this.logger.warn(`Failed to cache conversation list: ${error.message}`);
        }
      }

      return {
        data: paginatedData,
        total: conversations.length,
      };
    } catch (error) {
      this.logger.error('Lỗi khi lấy danh sách cuộc trò chuyện:', error);
      return { data: [], total: 0 };
    }
  }

  async findOne(id: string, userId: number): Promise<MessagesDto> {
    // Kiểm tra cache
    const cacheKey = `messages:single:${id}`;
    try {
      const cachedMessage = await this.cacheService.get<MessagesDto>(cacheKey);
      
      if (cachedMessage) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return cachedMessage;
      }
    } catch (error) {
      this.logger.warn(`Error getting cache: ${error.message}`);
    }
    
    const message = await this.messagesRepository.findOne({
      where: {
        id: id,
        // Đảm bảo người dùng có quyền xem tin nhắn này
        $or: [
          { senderId: userId },
          { receiverId: userId },
        ],
      } as any,
      // Áp dụng các mối quan hệ khác nếu cần
    });

    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    // Cache kết quả
    try {
      await this.cacheService.set(cacheKey, message, 300); // Cache trong 5 phút
      this.logger.debug(`Cached message at ${cacheKey}`);
    } catch (error) {
      this.logger.warn(`Failed to cache message: ${error.message}`);
    }

    return message;
  }

  async update(
    id: string,
    userId: number,
    updateMessagesDto: UpdateMessagesDto,
  ): Promise<MessagesDto> {
    // Tìm tin nhắn để cập nhật
    const message = await this.messagesRepository.findOne({
      where: {
        id: id,
        // Đảm bảo người dùng có quyền cập nhật tin nhắn này
        $or: [
          { senderId: userId },
          { receiverId: userId },
        ],
      } as any,
    });

    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    // Cập nhật tin nhắn
    await this.messagesRepository.update(id, updateMessagesDto);
    
    // Lấy tin nhắn đã cập nhật
    const updated = await this.messagesRepository.findOne({
      where: { id: id } as any,
    });
    
    if (!updated) {
      throw new NotFoundException('Không thể tìm thấy tin nhắn sau khi cập nhật');
    }

    // Invalidate cache
    try {
      await this.cacheService.del(`messages:single:${id}`);
      await this.cacheService.delPattern(`messages:conversations:${userId}*`);
      
      // Invalidate cache cho người nhận tin nhắn
      if (message.senderId === userId) {
        await this.cacheService.delPattern(`messages:conversations:${message.receiverId}*`);
        await this.cacheService.delPattern(`messages:thread:${userId}:${message.receiverId}*`);
        await this.cacheService.delPattern(`messages:thread:${message.receiverId}:${userId}*`);
      } else {
        await this.cacheService.delPattern(`messages:conversations:${message.senderId}*`);
        await this.cacheService.delPattern(`messages:thread:${userId}:${message.senderId}*`);
        await this.cacheService.delPattern(`messages:thread:${message.senderId}:${userId}*`);
      }
      
      this.logger.debug('Cache invalidated after updating message');
    } catch (error) {
      this.logger.warn(`Failed to invalidate cache: ${error.message}`);
    }

    return updated;
  }

  async markAsRead(userId: number, senderId: number): Promise<void> {
    // Đánh dấu tất cả tin nhắn từ senderId gửi đến userId là đã đọc
    await this.messagesRepository.updateMany(
      {
        senderId: senderId,
        receiverId: userId,
        isRead: false,
      } as any,
      { isRead: true },
    );
    
    // Invalidate cache
    try {
      await this.cacheService.delPattern(`messages:conversations:${userId}*`);
      await this.cacheService.delPattern(`messages:conversations:${senderId}*`);
      await this.cacheService.delPattern(`messages:thread:${userId}:${senderId}*`);
      await this.cacheService.delPattern(`messages:thread:${senderId}:${userId}*`);
      this.logger.debug('Cache invalidated after marking messages as read');
    } catch (error) {
      this.logger.warn(`Failed to invalidate cache: ${error.message}`);
    }
  }

  async remove(id: string, userId: number): Promise<void> {
    // Tìm tin nhắn để xóa
    const message = await this.messagesRepository.findOne({
      where: { 
        id: id,
        // Đảm bảo người dùng có quyền xóa tin nhắn này
        $or: [
          { senderId: userId },
          { receiverId: userId },
        ],
      } as any,
    });

    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    // Xóa tin nhắn (soft delete)
    await this.messagesRepository.update(id, { isDeleted: true });
    
    // Invalidate cache
    try {
      await this.cacheService.del(`messages:single:${id}`);
      await this.cacheService.delPattern(`messages:conversations:${userId}*`);
      
      // Invalidate cache cho người nhận tin nhắn
      if (message.senderId === userId) {
        await this.cacheService.delPattern(`messages:conversations:${message.receiverId}*`);
        await this.cacheService.delPattern(`messages:thread:${userId}:${message.receiverId}*`);
        await this.cacheService.delPattern(`messages:thread:${message.receiverId}:${userId}*`);
      } else {
        await this.cacheService.delPattern(`messages:conversations:${message.senderId}*`);
        await this.cacheService.delPattern(`messages:thread:${userId}:${message.senderId}*`);
        await this.cacheService.delPattern(`messages:thread:${message.senderId}:${userId}*`);
      }
      
      this.logger.debug('Cache invalidated after removing message');
    } catch (error) {
      this.logger.warn(`Failed to invalidate cache: ${error.message}`);
    }
  }
}

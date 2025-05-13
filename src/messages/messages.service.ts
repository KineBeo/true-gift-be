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

    // PRE-EMPTIVELY CLEAR CACHE before creating a message to ensure we won't get stale data
    this.logger.log(`Tiến hành xóa cache TRƯỚC khi tạo tin nhắn mới`);
    await this.clearMessageCache(userId, createMessagesDto.receiverId);

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

    // Lưu tin nhắn vào database
    const message = await this.messagesRepository.create(messageData);
    
    // Clear cache again AFTER creating the message to ensure fresh data
    this.logger.log(`Tiến hành xóa cache SAU khi tạo tin nhắn mới ${message.id}`);
    await this.clearMessageCache(userId, createMessagesDto.receiverId);
    
    return message;
  }

  // Consolidated cache clearing method to ensure consistent cache invalidation
  private async clearMessageCache(userId: number, receiverId: number): Promise<void> {
    // Chuẩn bị danh sách các key cần xóa trực tiếp
    const keysToDelete = [
      // Conversation cache keys - direct page 1 (most common)
      `messages:conversations:${userId}:1:10`, 
      `messages:conversations:${receiverId}:1:10`,
      // Thread cache keys - page 1 (most common) - cả ASC và DESC
      `messages:thread:${userId}:${receiverId}:1:20`,
      `messages:thread:${receiverId}:${userId}:1:20`,
      `messages:thread:${userId}:${receiverId}:1:20:desc`,
      `messages:thread:${receiverId}:${userId}:1:20:desc`,
      // Thread cache keys - page 1 với limit 50 (thường dùng)
      `messages:thread:${userId}:${receiverId}:1:50`,
      `messages:thread:${receiverId}:${userId}:1:50`,
      `messages:thread:${userId}:${receiverId}:1:50:desc`,
      `messages:thread:${receiverId}:${userId}:1:50:desc`,
    ];
    
    try {
      // 1. Xóa trực tiếp các key thông dụng
      await this.cacheService.directDeleteKeys(keysToDelete);
      this.logger.log(`Đã xóa trực tiếp ${keysToDelete.length} cache keys`);
      
      // 2. Xóa theo pattern để đảm bảo tất cả cache liên quan đều được làm mới
      const patterns = [
        `messages:conversations:${userId}:*`,
        `messages:conversations:${receiverId}:*`,
        `messages:thread:${userId}:${receiverId}:*`,
        `messages:thread:${receiverId}:${userId}:*`,
      ];
      
      for (const pattern of patterns) {
        await this.cacheService.delPattern(pattern);
        this.logger.log(`Đã xóa cache theo pattern: ${pattern}`);
      }
      
      this.logger.log(`Đã xóa cache thành công`);
    } catch (error) {
      this.logger.error(`Lỗi khi xóa cache: ${error.message}`);
    }
  }

  async findAll(
    userId: number,
    findAllMessagesDto: FindAllMessagesDto,
  ): Promise<{ data: MessagesDto[]; meta: { total: number } }> {
    const page = findAllMessagesDto.page || 1;
    const limit = findAllMessagesDto.limit || 20;
    
    // ALWAYS CLEAR CACHE before finding messages to ensure fresh data
    if (findAllMessagesDto.receiverId) {
      this.logger.log(`Chủ động xóa cache thread messages trước khi truy vấn từ người dùng ${userId} đến ${findAllMessagesDto.receiverId}`);
      try {
        await this.clearMessageCache(userId, findAllMessagesDto.receiverId);
      } catch (error) {
        this.logger.warn(`Không thể xóa cache thread messages: ${error.message}`);
      }
    }
    
    // Nếu đang tìm tin nhắn với một người cụ thể, kiểm tra cache
    if (findAllMessagesDto.receiverId) {
      // ALWAYS use DESC sorting for consistent caching
      const cacheKey = `messages:thread:${userId}:${findAllMessagesDto.receiverId}:${page}:${limit}:desc`;
      this.logger.log(`Checking cache with key: ${cacheKey}`);
      try {
        const cachedMessages = await this.cacheService.get<{ data: MessagesDto[]; meta: { total: number } }>(cacheKey);
        
        if (cachedMessages) {
          this.logger.log(`Cache hit for ${cacheKey}, returning ${cachedMessages.data.length} messages`);
          if (cachedMessages.data.length > 0) {
            this.logger.log(`First message in cache: ${cachedMessages.data[0].content}`);
            this.logger.log(`Last message in cache: ${cachedMessages.data[cachedMessages.data.length - 1].content}`);
          }
          return cachedMessages;
        } else {
          this.logger.log(`Cache miss for ${cacheKey}`);
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
            createdAt: 'DESC', // Sắp xếp giảm dần - mới nhất lên đầu
          },
        });
        
        // Log the raw data we found from the database
        if (result && result.data) {
          this.logger.log(`Found ${result.data.length} messages in database`);
          if (result.data.length > 0) {
            this.logger.log(`First message from DB: ${result.data[0].content}`);
            this.logger.log(`Last message from DB: ${result.data[result.data.length - 1].content}`);
          }
        }
        
        // Cache kết quả nếu tìm thấy tin nhắn
        if (result && result.data) {
          // ALWAYS use DESC sort in cache key
          const cacheKey = `messages:thread:${userId}:${findAllMessagesDto.receiverId}:${page}:${limit}:desc`;
          try {
            this.logger.log(`Setting cache for key: ${cacheKey} with ${result.data.length} messages`);
            if (result.data.length > 0) {
              this.logger.log(`First message being cached: ${result.data[0].content}`);
              this.logger.log(`Last message being cached: ${result.data[result.data.length - 1].content}`);
            }
            await this.cacheService.set(cacheKey, result, 300); // Cache trong 5 phút
            this.logger.log(`Successfully cached message thread at ${cacheKey}`);
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
            createdAt: 'DESC', // Sắp xếp giảm dần - mới nhất lên đầu
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
    // Xóa cache cũ trước khi kiểm tra (GIẢI PHÁP TẠM THỜI)
    this.logger.log(`Chủ động xóa cache cũ trước khi lấy hội thoại cho người dùng ${userId}`);
    try {
      await this.cacheService.delPattern(`messages:conversations:${userId}:*`);
    } catch (error) {
      this.logger.warn(`Không thể xóa cache cũ: ${error.message}`);
    }
  
    // Kiểm tra cache
    const cacheKey = `messages:conversations:${userId}:${page}:${limit}`;
    this.logger.log(`Đang tìm cache với key: ${cacheKey}`);
    try {
      const cachedConversations = await this.cacheService.get<{ data: any[]; total: number }>(cacheKey);
      
      if (cachedConversations) {
        this.logger.log(`Cache hit for ${cacheKey}, returning ${cachedConversations.data.length} conversations`);
        return cachedConversations;
      } else {
        this.logger.log(`Cache miss for ${cacheKey}, sẽ truy vấn từ database`);
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
    
    // Xóa cache sau khi cập nhật
    this.logger.log(`Xóa cache sau khi đánh dấu tin nhắn đã đọc từ ${senderId} đến ${userId}`);
    await this.clearMessageCache(userId, senderId);
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

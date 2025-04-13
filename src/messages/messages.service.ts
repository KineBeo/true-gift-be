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

@Injectable()
export class MessagesService {
  constructor(
    private readonly messagesRepository: messagesRepository,
    private readonly friendsService: FriendsService,
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

    return this.messagesRepository.create(messageData);
  }

  async findAll(
    userId: number,
    findAllMessagesDto: FindAllMessagesDto,
  ): Promise<{ data: MessagesDto[]; meta: { total: number } }> {
    const page = findAllMessagesDto.page || 1;
    const limit = findAllMessagesDto.limit || 20;
    
    try {
      // Lấy tin nhắn giữa người dùng và một người khác
      let result;
      console.log("ReceiverId", findAllMessagesDto.receiverId);
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
      console.error('Lỗi khi tìm tin nhắn:', error);
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

      return {
        data: paginatedData,
        total: conversations.length,
      };
    } catch (error) {
      console.error('Lỗi khi lấy danh sách cuộc trò chuyện:', error);
      return { data: [], total: 0 };
    }
  }

  async findOne(id: string, userId: number): Promise<MessagesDto> {
    const message = await this.messagesRepository.findOne({
      where: { id } as any,
    });

    if (!message) {
      throw new NotFoundException(`Tin nhắn với ID "${id}" không tồn tại`);
    }

    // Kiểm tra quyền truy cập tin nhắn
    if (message.senderId !== userId && message.receiverId !== userId) {
      throw new Error('Không có quyền truy cập tin nhắn này');
    }

    return message;
  }

  async update(
    id: string,
    userId: number,
    updateMessagesDto: UpdateMessagesDto,
  ): Promise<MessagesDto> {
    const message = await this.findOne(id, userId);

    // Chỉ người nhận tin nhắn mới có thể đánh dấu đã đọc
    if (
      updateMessagesDto.isRead !== undefined &&
      message.receiverId !== userId
    ) {
      throw new Error('Không có quyền đánh dấu tin nhắn này');
    }

    // Chỉ người gửi hoặc người nhận mới có thể xóa tin nhắn của mình
    if (updateMessagesDto.isDeleted !== undefined) {
      if (message.senderId !== userId && message.receiverId !== userId) {
        throw new Error('Không có quyền xóa tin nhắn này');
      }
    }

    await this.messagesRepository.update(id, updateMessagesDto as any);
    return this.findOne(id, userId);
  }

  async markAsRead(userId: number, senderId: number): Promise<void> {
    // Đánh dấu tất cả tin nhắn từ senderId gửi cho userId là đã đọc
    const whereCondition = {
      senderId,
      receiverId: userId,
      isRead: false
    } as any;
    
    await this.messagesRepository.updateMany(whereCondition, { isRead: true } as any);
  }

  async remove(id: string, userId: number): Promise<void> {
    const message = await this.findOne(id, userId);

    // Kiểm tra quyền xóa tin nhắn
    if (message.senderId !== userId && message.receiverId !== userId) {
      throw new Error('Không có quyền xóa tin nhắn này');
    }

    // Đánh dấu là đã xóa thay vì xóa thật sự
    await this.messagesRepository.update(id, { isDeleted: true } as any);
  }
}

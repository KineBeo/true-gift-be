import {
  // common
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { CreateFriendsDto } from './dto/create-friends.dto';
import { UpdateFriendsDto } from './dto/update-friends.dto';
import { friendsRepository } from './infrastructure/persistence/friends.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Friends } from './domain/friends';
import { FindAllFriendsDto } from './dto/find-all-friends.dto';
import { User } from '../users/domain/user';
import { FriendsDto } from './dto/friends.dto';
import { DataSource } from 'typeorm';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';

@Injectable()
export class FriendsService {
  constructor(
    private readonly friendsRepository: friendsRepository,
    private readonly dataSource: DataSource
  ) {}

  async create(
    userId: number,
    createFriendsDto: CreateFriendsDto,
  ): Promise<FriendsDto> {
    let targetFriendId: number;

    // Nếu có email, tìm người dùng theo email
    if (createFriendsDto.email) {
      const userRepository = this.dataSource.getRepository(UserEntity);
      const targetUser = await userRepository.findOne({ 
        where: { email: createFriendsDto.email } 
      });

      if (!targetUser) {
        throw new HttpException('Không tìm thấy người dùng với email này', HttpStatus.NOT_FOUND);
      }

      targetFriendId = targetUser.id;
    } else if (createFriendsDto.friendId) {
      targetFriendId = createFriendsDto.friendId;
    } else {
      throw new HttpException('Phải cung cấp email hoặc friendId', HttpStatus.BAD_REQUEST);
    }

    // Không thể tự kết bạn với chính mình
    if (userId === targetFriendId) {
      throw new HttpException('Không thể tự kết bạn với chính mình', HttpStatus.BAD_REQUEST);
    }

    // Kiểm tra nếu đã tồn tại kết bạn
    const existingFriend = await this.friendsRepository.findOne({
      where: {
        userId,
        friendId: targetFriendId,
      } as any,
    });

    if (existingFriend) {
      return existingFriend;
    }

    return this.friendsRepository.create({
      userId,
      friendId: targetFriendId,
      isBlocked: createFriendsDto.isBlocked || false,
    });
  }

  async findAll(
    user: User,
    findAllFriendsDto: FindAllFriendsDto,
  ): Promise<{ data: FriendsDto[]; total: number }> {
    const page = findAllFriendsDto.page || 1;
    const limit = findAllFriendsDto.limit || 10;
    
    // Xác định kiểu userId là number
    const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
    
    // Tạo các tùy chọn tìm kiếm
    const findOptions: any = {
      where: {
        userId,
        isAccepted: findAllFriendsDto.isAccepted,
        isBlocked: findAllFriendsDto.isBlocked,
      },
      skip: (page - 1) * limit,
      take: limit,
      order: {
        createdAt: 'DESC',
      },
    };
    
    // Nếu yêu cầu bao gồm thông tin quan hệ (từ frontend)
    if (findAllFriendsDto.includeRelations) {
      findOptions.relations = ['user', 'friend'];
    }
    
    return this.friendsRepository.findAll(findOptions);
  }

  async findOne(userId: number, id: string): Promise<FriendsDto | null> {
    return this.friendsRepository.findOne({
      where: {
        userId,
        id,
      } as any,
    });
  }

  async findAllFriendsForConversation(
    userId: number,
  ): Promise<FriendsDto[]> {
    // Lấy danh sách bạn bè đã được chấp nhận
    const { data } = await this.friendsRepository.findAll({
      where: [
        { userId, isAccepted: true, isBlocked: false } as any,
        { friendId: userId, isAccepted: true, isBlocked: false } as any,
      ],
      relations: ['user', 'friend'],
    });
    
    return data;
  }

  async findOneWithFriendId(
    userId: number,
    friendId: number,
  ): Promise<FriendsDto | null> {
    const friendship = await this.friendsRepository.findOne({
      where: [
        { userId, friendId } as any,
        { userId: friendId, friendId: userId } as any
      ],
    });
    
    return friendship;
  }

  async update(
    userId: number,
    id: string,
    updateFriendsDto: UpdateFriendsDto,
  ): Promise<FriendsDto | null> {
    const friend = await this.findOne(userId, id);
    if (!friend) {
      return null;
    }
    await this.friendsRepository.update(id, updateFriendsDto);
    return this.findOne(userId, id);
  }

  async acceptFriendRequest(userId: number, friendId: number): Promise<void> {
    // Tìm yêu cầu kết bạn từ friendId đến userId
    const friendRequest = await this.friendsRepository.findOne({
      where: {
        userId: friendId,
        friendId: userId,
      } as any,
    });

    if (friendRequest) {
      // Chấp nhận yêu cầu kết bạn
      await this.friendsRepository.update(friendRequest.id, {
        isAccepted: true,
      });

      // Tạo mối quan hệ bạn bè ngược lại
      const reverseRequest = await this.friendsRepository.findOne({
        where: {
          userId,
          friendId,
        } as any,
      });

      if (!reverseRequest) {
        await this.friendsRepository.create({
          userId,
          friendId,
          isAccepted: true,
        });
      } else {
        await this.friendsRepository.update(reverseRequest.id, {
          isAccepted: true,
        });
      }
    }
  }

  async getFriendRequests(
    userId: number,
    pagination?: { page: number; limit: number },
  ): Promise<{ data: FriendsDto[]; total: number }> {
    return this.friendsRepository.findAll({
      where: {
        friendId: userId,
        isAccepted: false,
        isBlocked: false,
      } as any,
      relations: ['user'],
      skip: pagination?.page ? (pagination.page - 1) * pagination.limit : 0,
      take: pagination?.limit || 10,
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async remove(userId: number, id: string): Promise<void> {
    const friend = await this.findOne(userId, id);
    
    if (friend) {
      await this.friendsRepository.delete(id);
      
      // Xóa cả mối quan hệ bạn bè ngược lại nếu có
      const reverseFriend = await this.friendsRepository.findOne({
        where: {
          userId: friend.friendId,
          friendId: userId,
        } as any,
      });
      
      if (reverseFriend) {
        await this.friendsRepository.delete(reverseFriend.id);
      }
    }
  }
}

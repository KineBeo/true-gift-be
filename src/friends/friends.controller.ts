import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { FriendsService } from './friends.service';
import { CreateFriendsDto } from './dto/create-friends.dto';
import { UpdateFriendsDto } from './dto/update-friends.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { Friends } from './domain/friends';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllFriendsDto } from './dto/find-all-friends.dto';
import { FriendsDto } from './dto/friends.dto';

@ApiTags('Friends')
@Controller({
  path: 'friends',
  version: '1',
})
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gửi lời mời kết bạn' })
  @ApiResponse({ status: 201, type: FriendsDto })
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req, @Body() createFriendsDto: CreateFriendsDto) {
    return this.friendsService.create(req.user.id, createFriendsDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách bạn bè' })
  @ApiResponse({ status: 200, type: [FriendsDto] })
  @HttpCode(HttpStatus.OK)
  async findAll(@Request() req, @Query() findAllFriendsDto: FindAllFriendsDto) {
    const result = await this.friendsService.findAll(req.user, findAllFriendsDto);
    return this.removePasswordFromResponse(result);
  }

  @Get('requests')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách lời mời kết bạn' })
  @ApiResponse({ status: 200, type: [FriendsDto] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @HttpCode(HttpStatus.OK)
  async getFriendRequests(
    @Request() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.friendsService.getFriendRequests(req.user.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });
    return this.removePasswordFromResponse(result);
  }

  @Post(':friendId/accept')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chấp nhận lời mời kết bạn' })
  @ApiResponse({ status: 200 })
  @HttpCode(HttpStatus.OK)
  async acceptFriendRequest(
    @Request() req,
    @Param('friendId') friendshipId: string,
  ) {
    // Find the friendship relationship first
    const friendship = await this.friendsService.findFriendshipById(friendshipId);
    
    if (!friendship) {
      throw new NotFoundException('Friend request not found');
    }
    
    // Make sure the current user is the target of the friend request
    if (friendship.friendId !== req.user.id) {
      throw new NotFoundException('This friend request is not for you');
    }
    
    // Accept the friend request using the sender's userId and the recipient's user ID (current user)
    return this.friendsService.acceptFriendRequest(req.user.id, friendship.userId);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin một bạn bè' })
  @ApiResponse({ status: 200, type: FriendsDto })
  @HttpCode(HttpStatus.OK)
  async findOne(@Request() req, @Param('id') id: string) {
    const result = await this.friendsService.findOne(req.user.id, id);
    if (result) {
      return this.removePasswordFromUser(result);
    }
    return result;
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật trạng thái bạn bè' })
  @ApiResponse({ status: 200, type: FriendsDto })
  @HttpCode(HttpStatus.OK)
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateFriendsDto: UpdateFriendsDto,
  ) {
    const result = await this.friendsService.update(req.user.id, id, updateFriendsDto);
    if (result) {
      return this.removePasswordFromUser(result);
    }
    return result;
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa bạn bè' })
  @ApiResponse({ status: 204 })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id') id: string) {
    return this.friendsService.remove(req.user.id, id);
  }
  
  /**
   * Remove password from user objects in a friends response object
   */
  private removePasswordFromResponse(response: { data: FriendsDto[]; total: number }) {
    const { data, total } = response;
    
    const sanitizedData = data.map(item => this.removePasswordFromUser(item));
    
    return {
      data: sanitizedData,
      total,
    };
  }
  
  /**
   * Remove password from user and friend objects in a single friend object
   */
  private removePasswordFromUser(friendItem: FriendsDto) {
    const clone = { ...friendItem };
    
    if (clone.user && 'password' in clone.user) {
      // Use type casting to access and delete the password property
      const user = clone.user as any;
      delete user.password;
    }
    
    if (clone.friend && 'password' in clone.friend) {
      // Use type casting to access and delete the password property
      const friend = clone.friend as any;
      delete friend.password;
    }
    
    return clone;
  }
}

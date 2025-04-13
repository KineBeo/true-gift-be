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
  findAll(@Request() req, @Query() findAllFriendsDto: FindAllFriendsDto) {
    return this.friendsService.findAll(req.user, findAllFriendsDto);
  }

  @Get('requests')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách lời mời kết bạn' })
  @ApiResponse({ status: 200, type: [FriendsDto] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @HttpCode(HttpStatus.OK)
  getFriendRequests(
    @Request() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.friendsService.getFriendRequests(req.user.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });
  }

  @Post(':friendId/accept')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chấp nhận lời mời kết bạn' })
  @ApiResponse({ status: 200 })
  @HttpCode(HttpStatus.OK)
  acceptFriendRequest(
    @Request() req,
    @Param('friendId') friendId: string,
  ) {
    return this.friendsService.acceptFriendRequest(req.user.id, Number(friendId));
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin một bạn bè' })
  @ApiResponse({ status: 200, type: FriendsDto })
  @HttpCode(HttpStatus.OK)
  findOne(@Request() req, @Param('id') id: string) {
    return this.friendsService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật trạng thái bạn bè' })
  @ApiResponse({ status: 200, type: FriendsDto })
  @HttpCode(HttpStatus.OK)
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateFriendsDto: UpdateFriendsDto,
  ) {
    return this.friendsService.update(req.user.id, id, updateFriendsDto);
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
}

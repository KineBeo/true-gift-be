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
import { MessagesService } from './messages.service';
import { CreateMessagesDto } from './dto/create-messages.dto';
import { UpdateMessagesDto } from './dto/update-messages.dto';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FindAllMessagesDto } from './dto/find-all-messages.dto';
import { MessagesDto } from './dto/messages.dto';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@ApiTags('Messages')
@Controller({
  path: 'messages',
  version: '1',
})
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Get('test-token')
  @ApiOperation({ summary: 'Tạo token test cho WebSocket (chỉ dùng cho dev)' })
  @ApiResponse({ status: 200 })
  @HttpCode(HttpStatus.OK)
  async getTestToken(@Query('userId') userId: string) {
    // Tạo token test cho WebSocket connection
    // CHỈ SỬ DỤNG TRONG MÔI TRƯỜNG DEVELOPMENT
    if (this.configService.get('NODE_ENV') !== 'development') {
      return { error: 'This endpoint is only available in development mode' };
    }

    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum)) {
      return { error: 'userId must be a number' };
    }

    const payload = {
      sub: userIdNum,
      id: userIdNum,
      role: 'user'
    };

    const token = this.jwtService.sign(payload, {
      secret: this.configService.get('AUTH_JWT_SECRET'),
      expiresIn: '1h'
    });

    return {
      userId: userIdNum,
      token,
      instructions: 'Use this token without Bearer prefix in WebSocket connection'
    };
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gửi tin nhắn mới' })
  @ApiResponse({ status: 201, type: MessagesDto })
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req, @Body() createMessagesDto: CreateMessagesDto) {
    return this.messagesService.create(req.user.id, createMessagesDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách tin nhắn' })
  @ApiResponse({ status: 200, type: [MessagesDto] })
  @HttpCode(HttpStatus.OK)
  findAll(@Request() req, @Query() findAllMessagesDto: FindAllMessagesDto) {
    return this.messagesService.findAll(req.user.id, findAllMessagesDto);
  }

  @Get('conversations')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách cuộc trò chuyện' })
  @ApiResponse({ status: 200 })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @HttpCode(HttpStatus.OK)
  getConversations(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagesService.getConversations(
      req.user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @Post(':userId/read')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đánh dấu tất cả tin nhắn từ một người là đã đọc' })
  @ApiResponse({ status: 200 })
  @HttpCode(HttpStatus.OK)
  markAsRead(@Request() req, @Param('userId') senderId: string) {
    return this.messagesService.markAsRead(req.user.id, Number(senderId));
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy chi tiết một tin nhắn' })
  @ApiResponse({ status: 200, type: MessagesDto })
  @HttpCode(HttpStatus.OK)
  findOne(@Request() req, @Param('id') id: string) {
    return this.messagesService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật trạng thái tin nhắn' })
  @ApiResponse({ status: 200, type: MessagesDto })
  @HttpCode(HttpStatus.OK)
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateMessagesDto: UpdateMessagesDto,
  ) {
    return this.messagesService.update(id, req.user.id, updateMessagesDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa tin nhắn' })
  @ApiResponse({ status: 204 })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id') id: string) {
    return this.messagesService.remove(id, req.user.id);
  }
}

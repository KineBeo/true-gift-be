import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../users/dto/user.dto';
import { FileDto } from '../../files/dto/file.dto';

export class MessagesDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: () => UserDto })
  sender?: UserDto | null;

  @ApiProperty()
  senderId: number;

  @ApiProperty({ type: () => UserDto })
  receiver?: UserDto | null;

  @ApiProperty()
  receiverId: number;

  @ApiProperty({ nullable: true })
  content: string | null;

  @ApiProperty({ type: () => FileDto, nullable: true })
  image?: FileDto | null;

  @ApiProperty()
  isRead: boolean;

  @ApiProperty()
  isDeleted: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../users/dto/user.dto';

export class FriendsDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: () => UserDto })
  user?: UserDto | null;

  @ApiProperty()
  userId: number;

  @ApiProperty({ type: () => UserDto })
  friend?: UserDto | null;

  @ApiProperty()
  friendId: number;

  @ApiProperty()
  isAccepted: boolean;

  @ApiProperty()
  isBlocked: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

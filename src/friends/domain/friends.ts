import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/domain/user';
import databaseConfig from '../../database/config/database.config';
import { DatabaseConfig } from '../../database/config/database-config.type';

// <database-block>
const idType = (databaseConfig() as DatabaseConfig).isDocumentDatabase
  ? String
  : String;
// </database-block>

export class Friends {
  @ApiProperty({ type: idType })
  id: string;

  @ApiProperty({ type: () => User })
  user: User;

  @ApiProperty({ type: () => Number })
  userId: number;

  @ApiProperty({ type: () => User })
  friend: User;

  @ApiProperty({ type: () => Number })
  friendId: number;

  @ApiProperty({ type: Boolean, default: false })
  isAccepted: boolean;

  @ApiProperty({ type: Boolean, default: false })
  isBlocked: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

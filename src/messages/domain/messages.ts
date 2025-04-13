import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/domain/user';
import { FileType } from '../../files/domain/file';
import databaseConfig from '../../database/config/database.config';
import { DatabaseConfig } from '../../database/config/database-config.type';

// <database-block>
const idType = (databaseConfig() as DatabaseConfig).isDocumentDatabase
  ? String
  : String;
// </database-block>

export class Messages {
  @ApiProperty({ type: idType })
  id: string;

  @ApiProperty({ type: () => User })
  sender: User;

  @ApiProperty({ type: () => Number })
  senderId: number;

  @ApiProperty({ type: () => User })
  receiver: User;

  @ApiProperty({ type: () => Number })
  receiverId: number;

  @ApiProperty({ type: String, nullable: true })
  content: string | null;

  @ApiProperty({ type: () => FileType, nullable: true })
  image: FileType | null;

  @ApiProperty({ type: Boolean, default: false })
  isRead: boolean;

  @ApiProperty({ type: Boolean, default: false })
  isDeleted: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

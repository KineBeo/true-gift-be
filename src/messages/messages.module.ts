import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { messagesEntity } from './infrastructure/persistence/relational/entities/messages.entity';
import { FriendsModule } from '../friends/friends.module';
import { MessagesProviders } from './providers';

@Module({
  imports: [
    TypeOrmModule.forFeature([messagesEntity]),
    FriendsModule,
  ],
  controllers: [MessagesController],
  providers: [...MessagesProviders],
  exports: [MessagesProviders[0]],  // Export MessagesService
})
export class MessagesModule {}

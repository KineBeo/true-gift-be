import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { friendsEntity } from './infrastructure/persistence/relational/entities/friends.entity';
import { FriendsProviders } from './providers';

@Module({
  imports: [
    TypeOrmModule.forFeature([friendsEntity]),
  ],
  controllers: [FriendsController],
  providers: [...FriendsProviders],
  exports: [FriendsProviders[0]],  // Export FriendsService
})
export class FriendsModule {}

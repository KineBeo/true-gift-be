import { Module } from '@nestjs/common';
import { friendsRepository } from '../friends.repository';
import { friendsRelationalRepository } from './repositories/friends.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { friendsEntity } from './entities/friends.entity';

@Module({
  imports: [TypeOrmModule.forFeature([friendsEntity])],
  providers: [
    {
      provide: friendsRepository,
      useClass: friendsRelationalRepository,
    },
  ],
  exports: [friendsRepository],
})
export class RelationalfriendsPersistenceModule {}

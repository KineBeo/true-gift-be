import { Provider } from '@nestjs/common';
import { friendsRepository } from './infrastructure/persistence/friends.repository';
import { friendsRelationalRepository } from './infrastructure/persistence/relational/repositories/friends.repository';
import { FriendsService } from './friends.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { friendsEntity } from './infrastructure/persistence/relational/entities/friends.entity';
import { DataSource } from 'typeorm';

export const FriendsProviders: Provider[] = [
  {
    provide: FriendsService,
    useFactory: (friendsRepo: friendsRepository, dataSource: DataSource) => {
      return new FriendsService(friendsRepo, dataSource);
    },
    inject: [friendsRepository, DataSource],
  },
  {
    provide: friendsRepository,
    useClass: friendsRelationalRepository,
  }
]; 
import { DataSource } from 'typeorm';
import { friendsEntity } from '../entities/friends.entity';

export const friendsProviders = [
  {
    provide: 'FRIENDS_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(friendsEntity),
    inject: ['DATA_SOURCE'],
  },
]; 
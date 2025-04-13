import { DataSource } from 'typeorm';
import { messagesEntity } from '../entities/messages.entity';

export const messagesProviders = [
  {
    provide: 'MESSAGES_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(messagesEntity),
    inject: ['DATA_SOURCE'],
  },
]; 
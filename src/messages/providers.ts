import { Provider } from '@nestjs/common';
import { messagesRepository } from './infrastructure/persistence/messages.repository';
import { messagesRelationalRepository } from './infrastructure/persistence/relational/repositories/messages.repository';
import { MessagesService } from './messages.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { messagesEntity } from './infrastructure/persistence/relational/entities/messages.entity';

export const MessagesProviders: Provider[] = [
  MessagesService,
  {
    provide: messagesRepository,
    useClass: messagesRelationalRepository,
  }
]; 
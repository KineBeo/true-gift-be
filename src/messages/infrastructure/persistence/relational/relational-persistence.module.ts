import { Module } from '@nestjs/common';
import { messagesRepository } from '../messages.repository';
import { messagesRelationalRepository } from './repositories/messages.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { messagesEntity } from './entities/messages.entity';

@Module({
  imports: [TypeOrmModule.forFeature([messagesEntity])],
  providers: [
    {
      provide: messagesRepository,
      useClass: messagesRelationalRepository,
    },
  ],
  exports: [messagesRepository],
})
export class RelationalmessagesPersistenceModule {}

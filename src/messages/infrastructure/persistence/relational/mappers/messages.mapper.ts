import { Messages } from '../../../../domain/messages';
import { messagesEntity } from '../entities/messages.entity';

export class messagesMapper {
  static toPersistence(domainModel: Messages): messagesEntity {
    const persistenceModel = new messagesEntity();
    persistenceModel.id = domainModel.id;
    persistenceModel.content = domainModel.content;
    persistenceModel.senderId = domainModel.senderId;
    persistenceModel.receiverId = domainModel.receiverId;
    persistenceModel.isRead = domainModel.isRead;
    persistenceModel.isDeleted = domainModel.isDeleted;

    return persistenceModel;
  }

  static toDomain(persistenceModel: messagesEntity): Messages {
    const domainModel = new Messages();
    domainModel.id = persistenceModel.id;
    domainModel.content = persistenceModel.content;
    domainModel.senderId = persistenceModel.senderId;
    domainModel.receiverId = persistenceModel.receiverId;
    domainModel.isRead = persistenceModel.isRead;
    domainModel.isDeleted = persistenceModel.isDeleted;
    domainModel.createdAt = persistenceModel.createdAt;
    domainModel.updatedAt = persistenceModel.updatedAt;

    return domainModel;
  }
}

import { Friends } from '../../../../domain/friends';
import { friendsEntity } from '../entities/friends.entity';

export class friendsMapper {
  static toDomain(raw: friendsEntity): Friends {
    const domainEntity = new Friends();
    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Friends): friendsEntity {
    const persistenceEntity = new friendsEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}

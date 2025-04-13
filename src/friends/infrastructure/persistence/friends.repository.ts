import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Friends } from '../../domain/friends';
import { Injectable } from '@nestjs/common';
import { Repository, FindManyOptions, FindOptionsWhere, FindOneOptions } from 'typeorm';
import { friendsEntity } from './relational/entities/friends.entity';
import { FriendsDto } from '../../dto/friends.dto';

@Injectable()
export abstract class friendsRepository {
  constructor(protected repository: Repository<friendsEntity>) {}

  abstract create(data: Partial<friendsEntity>): Promise<FriendsDto>;

  abstract findAll(options: FindManyOptions<friendsEntity>): Promise<{ data: FriendsDto[]; total: number }>;

  abstract findOne(options: FindOneOptions<friendsEntity>): Promise<FriendsDto | null>;

  abstract update(
    criteria: string | number | FindOptionsWhere<friendsEntity>,
    payload: Partial<friendsEntity>
  ): Promise<void>;

  abstract delete(id: string): Promise<void>;

  // Legacy methods compatible with the interface
  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<FriendsDto[]>;

  abstract findById(id: string): Promise<NullableType<FriendsDto>>;

  abstract findByIds(ids: string[]): Promise<FriendsDto[]>;

  abstract remove(id: string): Promise<void>;
}

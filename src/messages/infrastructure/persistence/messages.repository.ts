import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Messages } from '../../domain/messages';
import { Injectable } from '@nestjs/common';
import { Repository, FindManyOptions, FindOptionsWhere, In, FindOneOptions } from 'typeorm';
import { messagesEntity } from './relational/entities/messages.entity';
import { MessagesDto } from '../../dto/messages.dto';

@Injectable()
export abstract class messagesRepository {
  constructor(protected repository: Repository<messagesEntity>) {}

  abstract create(data: Partial<messagesEntity>): Promise<MessagesDto>;

  abstract findAll(options: FindManyOptions<messagesEntity>): Promise<{ data: MessagesDto[]; total: number }>;

  abstract findOne(options: FindOneOptions<messagesEntity>): Promise<MessagesDto | null>;

  abstract update(
    criteria: string | number | FindOptionsWhere<messagesEntity>,
    payload: Partial<messagesEntity>
  ): Promise<void>;

  // Method để xử lý cập nhật nhiều bản ghi
  abstract updateMany(
    criteria: FindOptionsWhere<messagesEntity>,
    payload: Partial<messagesEntity>
  ): Promise<void>;

  abstract delete(id: string): Promise<void>;

  // Legacy methods compatible with the interface
  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<MessagesDto[]>;

  abstract findById(id: string): Promise<NullableType<MessagesDto>>;

  abstract findByIds(ids: string[]): Promise<MessagesDto[]>;

  abstract remove(id: string): Promise<void>;
}

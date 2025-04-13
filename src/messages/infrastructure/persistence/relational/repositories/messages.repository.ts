import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindManyOptions, FindOneOptions, FindOptionsWhere, Repository } from 'typeorm';
import { messagesEntity } from '../entities/messages.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Messages } from '../../../../domain/messages';
import { messagesRepository } from '../../messages.repository';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { messagesMapper } from '../mappers/messages.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { MessagesDto } from '../../../../dto/messages.dto';

@Injectable()
export class messagesRelationalRepository extends messagesRepository {
  constructor(
    @InjectRepository(messagesEntity)
    protected readonly messagesEntityRepository: Repository<messagesEntity>,
    private readonly dataSource: DataSource,
  ) {
    super(messagesEntityRepository);
  }

  async create(data: Partial<messagesEntity>): Promise<MessagesDto> {
    const entity = this.messagesEntityRepository.create(data);
    await this.messagesEntityRepository.save(entity);
    return entity;
  }

  async findAll(options: FindManyOptions<messagesEntity>): Promise<{ data: MessagesDto[]; total: number }> {
    const [data, total] = await this.messagesEntityRepository.findAndCount(options);
    return { data, total };
  }

  async findOne(options: FindOneOptions<messagesEntity>): Promise<MessagesDto | null> {
    return this.messagesEntityRepository.findOne(options);
  }

  async update(
    criteria: string | number | FindOptionsWhere<messagesEntity>,
    payload: Partial<messagesEntity>
  ): Promise<void> {
    await this.messagesEntityRepository.update(criteria, payload);
  }

  async updateMany(
    criteria: FindOptionsWhere<messagesEntity>,
    payload: Partial<messagesEntity>
  ): Promise<void> {
    await this.messagesEntityRepository.update(criteria, payload);
  }

  async delete(id: string): Promise<void> {
    await this.messagesEntityRepository.delete(id);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<MessagesDto[]> {
    const entities = await this.messagesEntityRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return entities;
  }

  async findById(id: string): Promise<NullableType<MessagesDto>> {
    const entity = await this.messagesEntityRepository.findOne({
      where: { id },
    });

    return entity;
  }

  async findByIds(ids: string[]): Promise<MessagesDto[]> {
    return this.messagesEntityRepository.findByIds(ids);
  }

  async remove(id: string): Promise<void> {
    await this.messagesEntityRepository.delete(id);
  }
}

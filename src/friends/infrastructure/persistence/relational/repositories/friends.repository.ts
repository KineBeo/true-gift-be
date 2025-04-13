import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindManyOptions, FindOneOptions, FindOptionsWhere, Repository } from 'typeorm';
import { friendsEntity } from '../entities/friends.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Friends } from '../../../../domain/friends';
import { friendsRepository } from '../../friends.repository';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { friendsMapper } from '../mappers/friends.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { FriendsDto } from '../../../../dto/friends.dto';

@Injectable()
export class friendsRelationalRepository extends friendsRepository {
  constructor(
    @InjectRepository(friendsEntity)
    protected readonly friendsEntityRepository: Repository<friendsEntity>,
    private readonly dataSource: DataSource,
  ) {
    super(friendsEntityRepository);
  }

  async create(data: Partial<friendsEntity>): Promise<FriendsDto> {
    const entity = this.friendsEntityRepository.create(data);
    await this.friendsEntityRepository.save(entity);
    return entity;
  }

  async findAll(options: FindManyOptions<friendsEntity>): Promise<{ data: FriendsDto[]; total: number }> {
    const [data, total] = await this.friendsEntityRepository.findAndCount(options);
    return { data, total };
  }

  async findOne(options: FindOneOptions<friendsEntity>): Promise<FriendsDto | null> {
    return this.friendsEntityRepository.findOne(options);
  }

  async update(
    criteria: string | number | FindOptionsWhere<friendsEntity>,
    payload: Partial<friendsEntity>
  ): Promise<void> {
    await this.friendsEntityRepository.update(criteria, payload);
  }

  async delete(id: string): Promise<void> {
    await this.friendsEntityRepository.delete(id);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<FriendsDto[]> {
    const entities = await this.friendsEntityRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return entities;
  }

  async findById(id: string): Promise<NullableType<FriendsDto>> {
    const entity = await this.friendsEntityRepository.findOne({
      where: { id },
    });

    return entity;
  }

  async findByIds(ids: string[]): Promise<FriendsDto[]> {
    return this.friendsEntityRepository.findByIds(ids);
  }

  async remove(id: string): Promise<void> {
    await this.friendsEntityRepository.delete(id);
  }
}

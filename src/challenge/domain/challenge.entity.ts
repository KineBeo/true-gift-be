import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/infrastructure/persistence/relational/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

@Entity()
export class Challenge {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @ApiProperty()
  @Column()
  userId: number;

  @ApiProperty()
  @Column()
  description: string;

  @ApiProperty()
  @Column()
  class: string;

  @ApiProperty()
  @Column({ default: false })
  isCompleted: boolean;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  completedAt?: Date;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  photoId?: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true, type: 'float' })
  score?: number;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  detectedClass?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ApiProperty()
  @Column()
  expiresAt: Date;
}
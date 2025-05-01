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

@Entity()
export class Achievement {
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
  name: string;

  @ApiProperty()
  @Column()
  description: string;

  @ApiProperty()
  @Column({ unique: true })
  achievementCode: string;

  @ApiProperty()
  @Column({ default: false })
  isUnlocked: boolean;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  unlockedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
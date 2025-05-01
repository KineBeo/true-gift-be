import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/infrastructure/persistence/relational/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class UserStreak {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => UserEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @ApiProperty()
  @Column({ unique: true })
  userId: number;

  @ApiProperty()
  @Column({ default: 0 })
  currentStreak: number;

  @ApiProperty()
  @Column({ default: 0 })
  highestStreak: number;

  @ApiProperty()
  @Column({ default: 0 })
  totalCompleted: number;

  @ApiProperty()
  @Column({ default: 0 })
  totalAttempted: number;

  @ApiProperty()
  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  lastCompletedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
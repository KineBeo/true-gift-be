import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { FileEntity } from '../../../../../files/infrastructure/persistence/relational/entities/file.entity';

@Entity({
  name: 'messages',
})
@Index('idx_sender_receiver', ['senderId', 'receiverId'])
@Index('idx_receiver_sender', ['receiverId', 'senderId'])
@Index('idx_sender_receiver_is_deleted', ['senderId', 'receiverId', 'isDeleted'])
@Index('idx_receiver_sender_is_deleted', ['receiverId', 'senderId', 'isDeleted'])
export class messagesEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  @Index()
  sender: UserEntity;

  @Column()
  senderId: number;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receiverId' })
  @Index()
  receiver: UserEntity;

  @Column()
  receiverId: number;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @ManyToOne(() => FileEntity, { eager: true, nullable: true })
  @JoinColumn()
  image: FileEntity | null;

  @Column({ default: false })
  @Index()
  isRead: boolean;

  @Column({ default: false })
  @Index()
  isDeleted: boolean;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

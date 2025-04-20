import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { EntityRelationalHelper } from '../../../../utils/relational-entity-helper';

@Entity({ name: 'user_photo' })
export class UserPhotoEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'file_id' })
  fileId: string;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'created_at' })
  createdAt: Date;
} 
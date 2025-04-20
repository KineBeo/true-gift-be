import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateUserPhoto20240611000001 implements MigrationInterface {
  name = 'CreateUserPhoto20240611000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_photo',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'file_id',
            type: 'uuid',
          },
          {
            name: 'user_id',
            type: 'int',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'user_photo',
      new TableForeignKey({
        columnNames: ['file_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'file',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'user_photo',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('user_photo');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('user_photo', foreignKey);
      }
    }
    await queryRunner.dropTable('user_photo');
  }
} 
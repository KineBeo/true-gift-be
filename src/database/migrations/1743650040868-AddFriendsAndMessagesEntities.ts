import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFriendsAndMessagesEntities1743650040868
  implements MigrationInterface
{
  name = 'AddFriendsAndMessagesEntities1743650040868';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "senderId" integer NOT NULL, "receiverId" integer NOT NULL, "content" text, "isRead" boolean NOT NULL DEFAULT false, "isDeleted" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "imageId" uuid, CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2db9cf2b3ca111742793f6c37c" ON "messages" ("senderId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_acf951a58e3b9611dd96ce8904" ON "messages" ("receiverId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "friends" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" integer NOT NULL, "friendId" integer NOT NULL, "isAccepted" boolean NOT NULL DEFAULT false, "isBlocked" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_65e1b06a9f379ee5255054021e1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0c4c4b18d8a52c580213a40c08" ON "friends" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_867f9b37dcc79035fa20e8ffe5" ON "friends" ("friendId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_acf951a58e3b9611dd96ce89042" FOREIGN KEY ("receiverId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_520cd815423801ab085dcc76455" FOREIGN KEY ("imageId") REFERENCES "file"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "friends" ADD CONSTRAINT "FK_0c4c4b18d8a52c580213a40c084" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "friends" ADD CONSTRAINT "FK_867f9b37dcc79035fa20e8ffe5e" FOREIGN KEY ("friendId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "friends" DROP CONSTRAINT "FK_867f9b37dcc79035fa20e8ffe5e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "friends" DROP CONSTRAINT "FK_0c4c4b18d8a52c580213a40c084"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_520cd815423801ab085dcc76455"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_acf951a58e3b9611dd96ce89042"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_867f9b37dcc79035fa20e8ffe5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0c4c4b18d8a52c580213a40c08"`,
    );
    await queryRunner.query(`DROP TABLE "friends"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_acf951a58e3b9611dd96ce8904"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2db9cf2b3ca111742793f6c37c"`,
    );
    await queryRunner.query(`DROP TABLE "messages"`);
  }
}

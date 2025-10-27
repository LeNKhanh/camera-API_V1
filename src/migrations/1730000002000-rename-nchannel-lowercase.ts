import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameNChannelLowercase1730000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename column from "nChannelID" (with quotes) to nchannelid (lowercase, no quotes)
    await queryRunner.query(`ALTER TABLE events RENAME COLUMN "nChannelID" TO nchannelid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert back to quoted case-sensitive name
    await queryRunner.query(`ALTER TABLE events RENAME COLUMN nchannelid TO "nChannelID"`);
  }
}

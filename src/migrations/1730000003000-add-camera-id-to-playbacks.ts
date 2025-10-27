import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCameraIdToPlaybacks1730000003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add camera_id column if not exists
    await queryRunner.query(`ALTER TABLE playbacks ADD COLUMN IF NOT EXISTS camera_id UUID`);
    
    // Add foreign key constraint
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_playbacks_camera') THEN
          ALTER TABLE playbacks
          ADD CONSTRAINT fk_playbacks_camera FOREIGN KEY (camera_id) 
          REFERENCES cameras(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    
    // Create index
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_playbacks_camera ON playbacks(camera_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_playbacks_camera`);
    await queryRunner.query(`ALTER TABLE playbacks DROP CONSTRAINT IF EXISTS fk_playbacks_camera`);
    await queryRunner.query(`ALTER TABLE playbacks DROP COLUMN IF EXISTS camera_id`);
  }
}

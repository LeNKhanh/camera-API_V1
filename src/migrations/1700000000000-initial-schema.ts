import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "username" varchar(50) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "role" varchar(20) NOT NULL DEFAULT 'VIEWER',
        "refresh_token_hash" varchar(255),
        "refresh_token_exp" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username")
      )
    `);

    // Create cameras table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cameras" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "ip_address" varchar(45) NOT NULL,
        "channel" integer NOT NULL DEFAULT 1,
        "rtsp_url" varchar(255),
        "rtsp_port" integer NOT NULL DEFAULT 554,
        "sdk_port" integer DEFAULT 37777,
        "onvif_port" integer DEFAULT 80,
        "onvif_url" varchar(255),
        "username" varchar(100),
        "password" varchar(100),
        "codec" varchar(20) NOT NULL DEFAULT 'H.264',
        "resolution" varchar(20) NOT NULL DEFAULT '1080p',
        "vendor" varchar(50) NOT NULL DEFAULT 'dahua',
        "enabled" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cameras" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_cameras_ip_channel" UNIQUE ("ip_address", "channel")
      )
    `);

    // Create ptz_logs table (full schema matching entity)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ptz_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ILoginID" uuid NOT NULL,
        "nChannelID" integer NOT NULL DEFAULT 1,
        "action" varchar(40) NOT NULL,
        "command_code" integer NOT NULL DEFAULT 0,
        "speed" integer NOT NULL DEFAULT 1,
        "vector_pan" integer NOT NULL DEFAULT 0,
        "vector_tilt" integer NOT NULL DEFAULT 0,
        "vector_zoom" integer NOT NULL DEFAULT 0,
        "duration_ms" integer,
        "param1" integer,
        "param2" integer,
        "param3" integer,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ptz_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ptz_logs_camera_ILoginID" FOREIGN KEY ("ILoginID") 
          REFERENCES "cameras"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Create recordings table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recordings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "camera_id" uuid NOT NULL,
        "storage_path" varchar(500) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "started_at" timestamptz,
        "ended_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recordings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_recordings_camera" FOREIGN KEY ("camera_id") 
          REFERENCES "cameras"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Create snapshots table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "snapshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "camera_id" uuid NOT NULL,
        "storage_path" varchar(500) NOT NULL,
        "captured_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_snapshots" PRIMARY KEY ("id"),
        CONSTRAINT "FK_snapshots_camera" FOREIGN KEY ("camera_id") 
          REFERENCES "cameras"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Create events table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "camera_id" uuid NOT NULL,
        "type" varchar(50) NOT NULL,
        "description" text,
        "acknowledged" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_events_camera" FOREIGN KEY ("camera_id") 
          REFERENCES "cameras"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Create playbacks table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "playbacks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "recording_id" uuid NOT NULL,
        "user_id" uuid,
        "status" varchar(20) NOT NULL DEFAULT 'PAUSED',
        "position" integer NOT NULL DEFAULT 0,
        "speed" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_playbacks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_playbacks_recording" FOREIGN KEY ("recording_id") 
          REFERENCES "recordings"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_playbacks_user" FOREIGN KEY ("user_id") 
          REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cameras_ip" ON "cameras" ("ip_address")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cameras_enabled" ON "cameras" ("enabled")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ptz_logs_ILoginID" ON "ptz_logs" ("ILoginID")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ptz_logs_created" ON "ptz_logs" ("created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_recordings_camera" ON "recordings" ("camera_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_recordings_status" ON "recordings" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_snapshots_camera" ON "snapshots" ("camera_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_events_camera" ON "events" ("camera_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_events_type" ON "events" ("type")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (to respect foreign keys)
    await queryRunner.query(`DROP TABLE IF EXISTS "playbacks" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "events" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "snapshots" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recordings" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ptz_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cameras" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
  }
}

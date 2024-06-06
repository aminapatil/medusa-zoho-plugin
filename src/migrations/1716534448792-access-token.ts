import { MigrationInterface, QueryRunner } from "typeorm";

export class AccessToken1716534448792 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "access_token" ("id" character varying NOT NULL, 
            "client" character varying , 
            "access_token" character varying , 
            "refersh_token" character varying , 
            "expires_in" character varying , 
            "status" character varying , 
            "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
            "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now())`
        )
        await queryRunner.createPrimaryKey("access_token", ["id"])

    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE access_token DROP COLUMN is_delete;");

    }

}

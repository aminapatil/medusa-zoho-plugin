import { BaseEntity } from "@medusajs/medusa"
import { generateEntityId } from "@medusajs/utils"
import { BeforeInsert, Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity()
export class AccessToken extends BaseEntity {

  @PrimaryGeneratedColumn()
  id: string;

  @Column({ type: "varchar" })
  client: string

  @Column({ type: "varchar" })
  access_token: string

  @Column({ type: "varchar" })
  refersh_token: string

  @Column({ type: "varchar" })
  expires_in: string

  @Column({ type: "boolean", nullable: false })
  status: boolean

  @BeforeInsert()
  private beforeInsert(): void {
    this.id = generateEntityId(this.id, "access")
  }
}
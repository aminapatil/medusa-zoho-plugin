import { AccessToken } from "../models/access-token"
import { dataSource } from '@medusajs/medusa/dist/loaders/database'

export const AccessTokenRepository = dataSource.getRepository(AccessToken)

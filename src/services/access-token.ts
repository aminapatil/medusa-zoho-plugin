import { TransactionBaseService } from "@medusajs/medusa";
import { AccessTokenRepository } from "../repositories/access-token";
import { Lifetime } from "awilix"

export default class AccessTokenService extends TransactionBaseService {
    // static LIFE_TIME = Lifetime.TRANSIENT
    protected readonly accessTokenRepository_: typeof AccessTokenRepository

    constructor({ accessTokenRepository }) {
        super(arguments[0])
        this.accessTokenRepository_ = accessTokenRepository;
    }

    async create(data) {
        if (!data.access_token || !data.client || !data.expires_in) {
            throw new Error("Adding access_token requires access_token, client, expires_in")
        }
        /* @ts-ignore */
        const accessTokenRepo = this.activeManager_.withRepository(
            this.accessTokenRepository_
        )
        data.status = true;
        const createdReview = await accessTokenRepo.create(data)
        const accessToken = await accessTokenRepo.save(createdReview)
        return accessToken
    }

    async update(data) {
        if (!data.id || !data.access_token || !data.expires_in) {
            throw new Error("Updating a access_token requires id, display_name, content, rating, and approved")
        }
        /* @ts-ignore */
        const accessTokenRepo = this.activeManager_.withRepository(
            this.accessTokenRepository_
        )
        console.log("IN ACCESS TOKEN UPDATE METHOD\t" + JSON.stringify(data))
        const accessToken = await accessTokenRepo.update(data.id, data)
        return accessToken
    }

    async getAccessTokenByClient(client) {
        console.log(`***** GET ACCESS TOKEN BY CLIENT ${client} *****`)
        /* @ts-ignore */

        const accessTokenRepo = this.activeManager_.withRepository(
            this.accessTokenRepository_
        )
        return await accessTokenRepo.find({ where: { client: client } })

        // const resp = await this.accessTokenRepository_.find({
        //         where: {client: client}
        // })
        // console.log("***** GET ACCESS TOKEN BY CLIENT RESPONE ",  resp)
        // return resp;
    }

}
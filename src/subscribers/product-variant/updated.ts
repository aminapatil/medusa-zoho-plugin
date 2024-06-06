import {
    type SubscriberConfig,
    type SubscriberArgs,
    ProductVariantService,
} from "@medusajs/medusa"
import ZohoService from "src/services/zoho";

export default async function handleProductVariantCreated({
    data, eventName, container, pluginOptions,
}: SubscriberArgs<Record<string, string>>) {
    const zohoService: ZohoService = container.resolve("zohoService")
    zohoService.itemCreation(data.id,data.product_id);
}


export const config: SubscriberConfig = {
    event: ProductVariantService.Events.UPDATED,
    context: {
        subscriberId: "product-variant-created-handler",
    },
}
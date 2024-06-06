import {
  type SubscriberConfig,
  type SubscriberArgs,
  OrderService,
  UserService,
  UserRoles,
} from "@medusajs/medusa"
import ZohoService from "src/services/zoho";

export default async function handleOrderPlaced({
  data, eventName, container, pluginOptions,
}: SubscriberArgs<Record<string, string>>) {


  const orderService: OrderService = container.resolve(
    "orderService"
  )
  const userService: UserService = container.resolve(
    "userService"
  )
  const zohoService: ZohoService = container.resolve("zohoService")

  const order = await orderService.retrieve(data.id, {
    // you can include other relations as well
    select: [
      "id",
      "metadata",
      "created_at",
      "shipping_total",
      "discount_total",
      "tax_total",
      "refunded_total",
      "gift_card_total",
      "subtotal",
      "total",
    ],
    relations: [
      "customer",
      "billing_address",
      "shipping_address",
      "discounts",
      "discounts.rule",
      "shipping_methods",
      "shipping_methods.shipping_option",
      "payments",
      "fulfillments",
      "returns",
      "gift_cards",
      "gift_card_transactions"
    ],
  });
  let invoice =await zohoService.createInvoice(order);
  
}

export const config: SubscriberConfig = {
  event: OrderService.Events.PLACED,
  context: {
    subscriberId: "order-placed-handler",
  },
}
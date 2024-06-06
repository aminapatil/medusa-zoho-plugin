import {
    type SubscriberConfig,
    type SubscriberArgs,
    CustomerService,
} from "@medusajs/medusa"
import zohoService from "src/services/zoho"

export default async function handleRegisterCustomer({
    data, eventName, container, pluginOptions,
}: SubscriberArgs<Record<string, string>>) {
    const zohoService: zohoService = container.resolve("zohoService")
    const sendOptions = {
        templateId: "register",
        from: process.env.SES_EMAIL_FROM,
        to: data?.email,
        data: {
            name: data?.first_name ? data?.first_name + " " + data?.last_name : "Guest",
            email: data?.email,
            token: data?.token,
            login_url_link: process.env.STORE_BASE_URL,
            login_url_text: "Tikkiri Coffee",
            username: data?.email,
        },

    }

    // console.log("data---------->", data)
    const createContactOptions = {
        customer_id: data?.id,
    }
    await zohoService.createContact(createContactOptions);
}


export const config: SubscriberConfig = {
    event: CustomerService.Events.CREATED,
    context: {
        subscriberId: "register-customer-handler",
    },
}
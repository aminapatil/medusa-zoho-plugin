
import { Lifetime } from "awilix"
import { ProductService, ProductVariantService, OrderService } from "@medusajs/medusa/dist/services";
import ProductVariantRepository from "@medusajs/medusa/dist/repositories/product-variant";
import MoneyAmountRepository from "@medusajs/medusa/dist/repositories/money-amount";
import axios from 'axios'
import { ProductVariant, TransactionBaseService } from "@medusajs/medusa";
import CustomerRepository from "@medusajs/medusa/dist/repositories/customer";
import CartRepository from "@medusajs/medusa/dist/repositories/cart";
import { formatAmount } from "../utility";
import { getProductPrice } from "../utility/get-product-price";
// import { client as zohoClient } from "../utility/zohoClient";
import { clientConstant } from "../constants/clientConstant";
import DataStore from "./data-store";
import AccessTokenService from "./access-token";

class ZohoService extends TransactionBaseService {

    static LIFE_TIME = Lifetime.SCOPED
    static ZOHO_DATA_KEY = 'zoho'

    protected readonly productVariantService_: ProductVariantService
    protected readonly productService_: ProductService
    protected readonly orderService_: OrderService
    protected readonly productVariantRepository_: typeof ProductVariantRepository;
    protected readonly moneyAmountRepository_: typeof MoneyAmountRepository;
    protected readonly customerRepository_: typeof CustomerRepository;
    protected readonly cartRepository_: typeof CartRepository;
    // protected readonly stockLocationService_: StockLocationService;
    protected readonly accessTokenService_: AccessTokenService;
    protected zohoAuthData: any;

    constructor(container, options) {
        super(container)
        this.productVariantService_ = container.productVariantService
        this.productVariantRepository_ = container.productVariantRepository
        this.moneyAmountRepository_ = container.moneyAmountRepository
        this.productService_ = container.productService
        this.orderService_ = container.orderService
        this.customerRepository_ = container.customerRepository
        this.cartRepository_ = container.cartRepository
        // this.stockLocationService_ = container.stockLocationService
        this.accessTokenService_ = container.accessTokenService
    }

    async getAccessTokenDB() {
        console.log("***** GET ACCEESS TOKEN FROM DB *****");
        const accessTokenResp = await this.accessTokenService_.getAccessTokenByClient(clientConstant.ZOHO);
        // console.log("***** GET ACCEESS TOKEN FROM DB RESPONSE: *****", this.zohoAuthData);
        const store = DataStore.getInstance();
        store.set(ZohoService.ZOHO_DATA_KEY, accessTokenResp);
    }

    async generateAccessToken() {
        const url = `${process.env.ZOHO_AUTH_BASE_URL}/
        oauth/v2/token?code=${process.env.ZOHO_CODE}&client_id=${process.env.ZOHO_CLIENT_ID}
        &client_secret=${process.env.ZOHO_CLIENT_SECRET_ID}&grant_type=authorization_code`;

        const option = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        }
        console.error('***** GENERATE ACCESS TOKEN URL *****:', url);
        try {
            const response = await fetch(url, option)
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('***** GENERATE ACCESS TOKEN ERROR *****:', error);
        }
    }

    async generateAccessTokenFromRefreshToken() {
        // const authData = await this.generateAccessToken();
        let refresh_token = process.env.ZOHO_REFRESH_TOKEN;
        const url = `${process.env.ZOHO_AUTH_BASE_URL}/oauth/v2/token?refresh_token=${refresh_token}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET_ID}&grant_type=refresh_token`;

        const option = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        }
        console.log('***** GENERATE ACCESS REFRESH TOKEN URL *****:', url);
        try {
            const response = await fetch(url, option)
            const resp = await response.json();
            console.log('***** GENERATE ACCESS REFRESH TOKEN RESPONE *****:', resp);
            if (response?.status === 200) {
                return await this.saveAcessToken(resp)
            } else {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
        } catch (error) {
            console.error('***** GENERATE ACCESS REFRESH TOKEN ERROR *****:', error);
        }
    }

    async saveAcessToken(resp: any) {
        console.log("***** IN SAVE ACCESS TOKEN DATA *****", resp);
        // let accessToken = await this.accessTokenService_.getAccessTokenByClient(clientConstant.ZOHO);
        // const tokenData = await this.getAccessTokenDB()
        const store = DataStore.getInstance();
        const value = store.get('zoho');
        console.log("****** ZOHO AUTH DATA ******", value)
        if (value?.length > 0) {
            console.log("****** IN SAVE ACCESS UPDTAE CALL ******")
            let access = value[0];
            access.access_token = resp.access_token;
            access.expires_in = this.addHours(resp.expires_in);
            const store = DataStore.getInstance();
            store.set('zoho', access);
            console.log("****** IN SAVE ACCESS UPDTAE CALL ******" + JSON.stringify(access))
            return await this.accessTokenService_.update(access);
        } else {
            console.log("****** IN SAVE ACCESS CREATE CALL ******")
            let access_token = {
                client: clientConstant.ZOHO,
                access_token: resp.access_token,
                expires_in: this.addHours(resp.expires_in)
            }
            const store = DataStore.getInstance();
            store.set('zoho', access_token);
            console.log(access_token)
            return await this.accessTokenService_.create(access_token);
        }
    }

    async itemCreation(variant_id, product_id: string) {
        console.log('***** ZOHO ITEM CREATION *****:');
        await this.getAccessTokenDB();
        const taxDetail: any = await this.getTaxDetail();
        console.log("******** ITEM CREATION TAX RESPONSE **********", taxDetail);
        let product = await this.productService_.retrieve(product_id, { relations: ["variants", "variants.prices"] })
        let url = `/books/v3/items?organization_id=${process.env.ZOHO_ORGANIZATION_ID}`;
        if (product) {
            product.variants?.forEach(async (lineItem) => {
                if (variant_id == lineItem.id) {
                    let price = lineItem.prices.find(pr => pr.currency_code == "inr");
                    let amount = 0;
                    if (price) formatAmount({ amount: price?.amount, region: price.region, includeTaxes: false })
                    let item_tax_preferences = [];
                    taxDetail.map(tax => {
                        if (tax.tax_name !== "GST0") {
                            item_tax_preferences.push({
                                "tax_id": tax?.tax_id,
                                "tax_specification": tax?.tax_specification
                            });
                        }
                    });
                    console.log('***** IN ZOHO ITEM CREATION *****:item_tax_preferences----->', item_tax_preferences)
                    let payload: any = {
                        "name": `${product.title}-${lineItem.title}`,
                        "rate": amount,
                        "description": product.description,
                        // "tax_id": taxDetail?.tax_id,
                        // "tax_percentage": taxDetail?.tax_percentage,
                        "sku": lineItem.sku,
                        "product_type": "goods",
                        "hsn_or_sac": lineItem.hs_code,
                        "is_taxable": true,
                        "account_id": "",
                        "item_type": "sales",
                        "purchase_description": "",
                        "purchase_rate": "",
                        "purchase_account_id": "",
                        "vendor_id": "",
                        "item_tax_preferences": item_tax_preferences
                    }
                    let metadata: any = lineItem?.metadata;
                    url = metadata?.hasOwnProperty("zoho") ?
                        `/books/v3/items/${metadata.zoho?.item_id}?organization_id=${process.env.ZOHO_ORGANIZATION_ID}` : url

                    payload.item_id = metadata?.zoho?.item_id
                    if (!metadata?.hasOwnProperty("zoho"))
                        await this.createLineItem(url, payload, metadata, lineItem);
                    else
                        await this.updateLineItem(url, payload, metadata, lineItem);
                }
            });

        }
    }

    async updateLineItem(url, payload, metadata, lineItem) {
        console.log('***** IN ZOHO ITEM UPDATE LINE ITEM *****:');
        const store = DataStore.getInstance();
        const value = store.get(ZohoService.ZOHO_DATA_KEY);
        try {
            await (await this.client(value)).put(url, payload).then((res: any) => {
                console.log('***** IN ZOHO ITEM UDPATE LINE ITEM RESPONE *****:', res?.data);
                return res?.data;
            });
        } catch (error) {
            console.error("Error IN ZOHO ITEM UPDATE LINE ITEM CATCH:", error);
            return null;
        }

    }


    async createLineItem(url, payload, metadata, lineItem) {
        console.log('***** IN ZOHO ITEM CREATE LINE ITEM *****:');
        const store = DataStore.getInstance();
        const value = store.get(ZohoService.ZOHO_DATA_KEY);
        try {
            await (await this.client(value)).post(url, payload).then((res: any) => {
                let variant = new ProductVariant()
                variant = lineItem;
                variant.metadata = { "zoho": { "item_id": res.data.item.item_id } }
                this.productVariantRepository_.save(variant)
                console.log('***** IN ZOHO ITEM CREATE LINE ITEM RESPONE *****:', res?.data);
                return res?.data;
            });
        } catch (error) {
            console.error("Error IN ZOHO ITEM CREATE LINE ITEM CATCH:", error);
            return null;
        }

    }

    async getTaxDetail() {
        const url = `/books/v3/settings/taxes?organization_id=${process.env.ZOHO_ORGANIZATION_ID}`;
        const store = DataStore.getInstance();
        const value = store.get(ZohoService.ZOHO_DATA_KEY);
        console.log("***** IN GET TAX DETAIL CALL AUTH DATA *****", value)
        try {
            return await (await this.client(value)).get(url).then((res: any) => {
                console.log("***** ZOHO TAX DETAIL RESPONSE *****", res?.data);
                let taxNameJson = process.env.ZOHO_TAX_NAME;
                return res?.data.taxes?.filter((tax: any) => taxNameJson.includes(tax.tax_name));
            }).catch((error) => {
                console.log("***** ZOHO TAX DETAIL RESPONSE *****", error)
            });
        } catch (error) {
            console.error("Error IN ZOHO TAX DETAIL CATCH:", error);
            return null;
        }

    }

    async createContact(payload) {
        console.log("***** IN ZOHO CREATE CONTACT *****");
        await this.getAccessTokenDB();
        let customer = await this.customerRepository_.findOneBy({
            id: payload.customer_id
        });
        let customerZohoContactId: any;
        customerZohoContactId = await customer.metadata?.zoho ? customer.metadata?.zoho["zoho_contact_id"] : null;

        if (customerZohoContactId) {
            console.log("***** ZOHO CONTACT ID ALREADY AVAILABLE *****");
            return "zoho_contact_id is already created !!"
        }

        let first_name: any,
            last_name: any,
            billing_address: any,
            shipping_address: any,
            email: any,
            phone: any;

        if (!customer?.has_account) {
            const customerAddress = await this.cartRepository_.find({
                where: {
                    customer_id: payload.customer_id
                },
                relations: ["billing_address", "shipping_address"]
            });

            first_name = customerAddress[0]?.billing_address?.first_name;
            last_name = customerAddress[0]?.billing_address?.last_name;
            billing_address = {
                attention: "", //TODO - what will be salutation
                address: customerAddress[0].billing_address?.address_1 ? customerAddress[0].billing_address?.address_1 : "",
                street2: customerAddress[0].billing_address.address_2 ? customerAddress[0].billing_address.address_2 : "",
                state_code: "",
                city: customerAddress[0].billing_address.city ? customerAddress[0].billing_address.city : "",
                state: customerAddress[0].billing_address.province ? customerAddress[0].billing_address.province : "",
                zip: customerAddress[0].billing_address.postal_code ? customerAddress[0].billing_address.postal_code : "",
                country: customerAddress[0].billing_address.country_code ? customerAddress[0].billing_address.country_code : "",
                fax: "",
                phone: customerAddress[0].billing_address.phone ? customerAddress[0].billing_address.phone : ""
            }
            shipping_address = {
                attention: "", //TODO - what will be salutation
                address: customerAddress.length > 0 && customerAddress[0].shipping_address?.address_1 ? customerAddress[0].shipping_address?.address_1 : "",
                street2: customerAddress.length > 0 && customerAddress[0].shipping_address?.address_2 ? customerAddress[0].shipping_address?.address_2 : "",
                state_code: "",
                city: customerAddress.length > 0 && customerAddress[0].shipping_address?.city ? customerAddress[0].shipping_address?.city : "",
                state: customerAddress.length > 0 && customerAddress[0].shipping_address?.province ? customerAddress[0].shipping_address?.province : "",
                zip: customerAddress.length > 0 && customerAddress[0].shipping_address?.postal_code ? customerAddress[0].shipping_address?.postal_code : "",
                country: customerAddress.length > 0 && customerAddress[0].shipping_address?.country_code ? customerAddress[0].shipping_address?.country_code : "",
                fax: "",
                phone: customerAddress[0].shipping_address?.phone ? customerAddress[0].shipping_address?.phone : ""
            }
            email = customerAddress[0].email;

        } else {
            first_name = customer?.first_name;
            last_name = customer?.last_name;
            billing_address = "";
            shipping_address = "";
            email = customer?.email;
            phone = customer?.phone; //NOTE - phone number is null while registering the new customer
        }
        let body = {
            contact_name: first_name ? first_name + " " + last_name : "",
            language_code: "en",
            contact_type: "customer",
            customer_sub_type: "individual",
            is_portal_enabled: false,
            billing_address: billing_address ? billing_address : "",
            shipping_address: shipping_address ? shipping_address : "",
            contact_persons: [{ //NOTE - It is the array of contact person so how to use it
                "salutation": "",
                "first_name": first_name ? first_name : "",
                "last_name": last_name ? last_name : "",
                "email": email ? email : "",
                "phone": phone ? phone : "",
                "mobile": "",
                "designation": "",
                "department": "",
                "is_primary_contact": true,
                "enable_portal": false
            }],
            place_of_contact: "",
            gst_treatment: "consumer"
        }
        const url = `/books/v3/contacts?organization_id=${process.env.ZOHO_ORGANIZATION_ID}`;
        try {
            const store = DataStore.getInstance();
            const value = store.get(ZohoService.ZOHO_DATA_KEY);

            console.log("******IN CREAET CONTACT ACCESS TOKEN VALUE******\t" + value)
            let response = await (await this.client(value)).post(url, body).then(async (response) => {
                return response;
            }).catch(async err => {
                console.log(err);
                return await err.json()
            });
            console.log("***** IN ZOHO CREATE CONTACT : RESPONSE *****", response);
            const contactId = {
                "zoho_contact_id": response?.data?.contact?.contact_id
            }
            console.log("***** IN ZOHO CREATE CONTACT : CREATED CONTACT_ID *****", contactId);

            if (customer) {
                console.log("***** IN ZOHO CREATE CONTACT : CUSTOMER EXISTS : UPDATE METADATA *****");
                let metadata = { ...customer.metadata };
                if (metadata) {
                    metadata.zoho = contactId;
                } else {
                    metadata = { "zoho": contactId }
                }
                customer.metadata = { ...metadata };
                await this.customerRepository_.save(customer);
            }
            return response;
        } catch (error) {
            console.error("Error IN ZOHO CREATE CONTACT CATCH:", error);
            return null;
        }

    }

    async updateContact(payload) {
        console.log("***** IN UPDATE CONTACT *****")
        await this.getAccessTokenDB();
        let customerZohoContactId: any;
        let customer: any;
        if (payload?.customer_id) {
            customer = await this.customerRepository_.findOneBy({
                id: payload?.customer_id
            })
        } else {
            customer = await this.customerRepository_.findOneBy({
                email: payload?.email,
                has_account: false
            }
            )
        }

        console.log("***** IN ZOHO UPDATE CONTACT CUSTOMER *****", customer)
        if (!customer) return;

        customerZohoContactId = await customer.metadata?.zoho && customer.metadata?.zoho?.zoho_contact_id;
        console.log("***** IN ZOHO UPDATE: ZOHO CONTACT ID  *****", customerZohoContactId)

        if (!customerZohoContactId) {
            let createRes = await this.createContact({ customer_id: customer?.id });
            return createRes;
        }
        let body = {
            contact_name: payload?.billing_address?.first_name + " " + payload?.billing_address?.last_name,
            billing_address: {
                attention: "", //TODO - what will be salutation
                address: payload?.billing_address?.address_1 ? payload?.billing_address?.address_1 : "",
                street2: payload?.billing_address?.address_2 ? payload?.billing_address?.address_2 : "",
                state_code: "",
                city: payload?.billing_address?.city ? payload?.billing_address?.city : "",
                state: payload?.billing_address?.province ? payload?.billing_address?.province : "",
                zip: payload?.billing_address?.postal_code ? payload?.billing_address?.postal_code : "",
                country: payload?.billing_address?.country_code ? payload?.billing_address?.country_code : "",
                fax: "",
                phone: payload?.billing_address?.phone ? payload?.billing_address?.phone : ""
            },
            shipping_address: {
                attention: "",
                address: payload?.shipping_address?.address_1 ? payload?.shipping_address?.address_1 : "",
                street2: payload?.shipping_address?.address_2 ? payload?.shipping_address?.address_2 : "",
                state_code: "",
                city: payload?.shipping_address?.city ? payload?.shipping_address?.city : "",
                state: payload?.shipping_address?.province ? payload?.shipping_address?.province : "",
                zip: payload?.shipping_address?.postal_code ? payload?.shipping_address?.postal_code : "",
                country: payload?.shipping_address?.country_code ? payload?.shipping_address?.country_code : "",
                fax: "",
                phone: payload?.shipping_address?.phone ? payload?.shipping_address?.phone : ""
            },
            contact_persons: [{
                "salutation": "", //TODO - What will be the value
                "first_name": payload?.billing_address?.first_name ? payload?.billing_address?.first_name : "",
                "last_name": payload?.billing_address?.last_name ? payload?.billing_address?.last_name : "",
                "email": payload?.email ? payload?.email : "",
                "phone": payload?.billing_address?.phone ? payload?.billing_address?.phone : "",
                "mobile": "",
                "designation": "",
                "department": "",
                "is_primary_contact": true,
                "enable_portal": false
            }],
            place_of_contact: payload?.shipping_address?.state_code ? payload?.shipping_address?.state_code : "",
        }

        const url = `/books/v3/contacts/${customerZohoContactId}?organization_id=${process.env.ZOHO_ORGANIZATION_ID}`;

        console.log("***** IN ZOHO UPDATE CONTACT: PAYLOAD *****", payload)
        try {
            const store = DataStore.getInstance();
            const value = store.get(ZohoService.ZOHO_DATA_KEY);

            return await (await this.client(value)).put(url, body).then((response) => {
                console.error("***** ZOHO UPDATE CONTACT RESPONSE *****", response);
                return response.data;
            }).catch(err => {
                console.error("***** ZOHO UPDATE CONTACT ERROR *****", err);
                return err.json()
            });
        } catch (error) {
            console.error("Error IN ZOHO UPDATE CONTAC CATCH:", error);
            return null;
        }

    }

    async fetchDetail(order) {
        console.log(order, "order ");
        try {
            if (!order) {
                return null;
            }
            const cart = { ...order };
            if (cart.items?.length) {
                const enrichedItems = await this.enrichLineItems(cart.items, order.region.id);
                console.log(cart.items, cart.region.id, "cart.items, cart.region.id");
                cart.items = enrichedItems;
            }
            return cart;
        } catch (error) {
            console.error('Error fetching cart:', error);
            return null;
        }
    }


    async enrichLineItems(lineItems, regionId) {
        try {
            const queryParams: any = {
                id: lineItems.map((lineItem) => lineItem.variant.product_id),
                region_id: regionId,
            };
            console.log(queryParams, "queryParams");
            // const productsResponse = await this.productService_.retrieve(queryParams.id)
            // let url = 
            const productsResponse = await axios.create({
                baseURL: process.env.ADMIN_BACKEND_URL,
                headers: {
                    'content-type': 'application/json',
                },

            }).get(`/store/products?id[]=${queryParams.id}&region_id=${regionId}`).then((res: any) => {
                console.log(res)

                return res?.data.products;
            });

            console.log(productsResponse, "productsResponse");
            const products: any = productsResponse || {};

            if (!lineItems?.length || !products.length) {
                return [];
            }
            const enrichedItems = lineItems.map((item) => {
                const product = products.find((p) => p.id === item.variant.product_id);
                const variant = product?.variants.find((v) => v.id === item.variant_id);

                if (!product || !variant) {
                    return item;
                }
                return {
                    ...item,
                    variant: {
                        ...variant,
                        product: product,
                    },
                };
            });

            return enrichedItems;
        } catch (error) {
            console.error('Error enriching line items:', error);
            return [];
        }
    }


    async createInvoice(order) {
        await this.getAccessTokenDB();
        let formattedDate = this.formatDate(order.created_at);

        const taxDetail = await this.getTaxDetail();

        const details = await this.fetchDetail(order);
        console.log(details, "details");
        console.log("***** IN ZOHO CREATE INVOICE : ORDER DATA *****", order)

        let shippin_charges = formatAmount({ amount: order.shipping_total, region: null, includeTaxes: false })
        // let list = await this.stockLocationService_.list();

        // list = list.length > 0 && list.filter((location) => location?.metadata?.state == order?.shipping_address?.province);
        let place_of_supply = process.env.ZOHO_DEFAULT_PLACE_OF_SUPPLY || "MH";

        let line = []
        details.items.map((item, index) => {
            let discount: any = "0";
            if (item.variant.calculated_price_type == 'sale') {
                console.log("********** CREATE INVOICE : ITEM VARIANT ***********", item?.variant)
                if (item?.discount_total > 0) {
                    discount = getProductPrice({ variant: [item.variant], region: order.region, total: (item?.subtotal - item?.discount_total), quantity: item.quantity }).cheapestPrice.discountAmt;
                } else {
                    discount = getProductPrice({ variant: [item.variant], region: order.region, quantity: item.quantity }).cheapestPrice.discountAmtSale;
                }
            } else if (item?.discount_total > 0) {
                discount = item.discount_total //formatAmount({ amount: item.discount_total, region: null, includeTaxes: false })
            }
            console.log("********** LINE ITEM DISCOUNT PERCENTAGE **********", discount)
            let ln: any = {
                item_id: item.variant?.metadata?.zoho?.item_id,
                product_type: "goods",
                name: item.title,
                description: item.description,
                hsn_or_sac: item.variant.hs_code,
                item_order: index + 1,//no - sequence
                rate: formatAmount({ amount: item.variant.original_price, region: null, includeTaxes: false }),
                quantity: item.quantity,
                discount: formatAmount({ amount: discount, region: null, includeTaxes: false }),

            }
            if (item.original_tax_total == 0) {
                taxDetail.map(tax => {
                    if (tax.tax_name == "GST0") {
                        ln.tax_id = tax?.tax_id,
                            ln.tax_name = tax.tax_name,
                            ln.tax_type = tax?.tax_type,
                            ln.tax_percentage = tax?.tax_percentage
                    }
                });

            }
            line.push(ln)
        })

        const payload: any = {
            customer_id: order?.customer?.metadata?.zoho?.zoho_contact_id,
            gst_treatment: "consumer",
            // gst_no: process.env.ZOHO_GST_NO || "22AAAAA0000A1Z5",//no , store in env //TBD only for business
            date: formattedDate,
            discount: (order.discount_total > 0) && formatAmount({ amount: order.discount_total, region: null, includeTaxes: false }) || 0, // order.discount.,
            is_discount_before_tax: true,//no
            discount_type: "item_level",
            is_inclusive_tax: false,
            line_items: line,
            allow_partial_payments: false,
            custom_body: "",
            custom_subject: "",
            notes: "Looking forward for your business.",
            terms: "Terms & Conditions apply",
            shipping_charge: shippin_charges,
            adjustment: 0,//no
            // tax_id: taxDetail?.tax_id,
            place_of_supply: place_of_supply
        }
        console.log("***** IN ZOHO CREATE INVOICE : PAYLOAD *****", payload)

        const url = `/books/v3/invoices?organization_id=${process.env.ZOHO_ORGANIZATION_ID}`;
        try {
            const store = DataStore.getInstance();
            const value = store.get(ZohoService.ZOHO_DATA_KEY);
            return await (await this.client(value)).post(url, payload).then(async (res: any) => {
                console.log("***** IN ZOHO CREATE INVOICE : RESPONSE *****", res)
                // if (res?.data.invoice.invoice_id) {
                //     await this.orderService_.update(order.id, {
                //         metadata: { ...order.metadata, invoice_id: res?.data.invoice.invoice_id }
                //     });
                // };
                return this.getGeneratedInvoice(res?.data.invoice.invoice_id, value)
            }).catch(e => {
                console.error("***** ZOHO CREATE INVOICE ERROR *****", e.response.data);
            });
        } catch (error) {
            console.error("Error IN ZOHO CREATE INVOICE CATCH BLOCK:", error);
            return null;
        }
    }

    formatDate(date: any) {
        const orderDate = new Date(date);
        const day = orderDate.getUTCDate().toString().padStart(2, '0');
        const month = (orderDate.getUTCMonth() + 1).toString().padStart(2, '0');
        const year = orderDate.getUTCFullYear();
        return `${year}-${month}-${day}`;
    }

    async getGeneratedInvoice(invoice_id: string, value) {
        console.log("***** IN ZOHO GENERATE INVOICE : INVOICE_ID *****", invoice_id)
        await this.getAccessTokenDB();
        const store = DataStore.getInstance();
        const storeValue = store.get(ZohoService.ZOHO_DATA_KEY) || value;
        const url = `/books/v3/invoices/pdf?organization_id=${process.env.ZOHO_ORGANIZATION_ID}&invoice_ids=${invoice_id}`;
        try {
            const response = await (await this.client(storeValue)).get(url, { responseType: "arraybuffer" });
            console.log("***** GENERATE INVOICE PDF RESPONSE : ", response);
            if (response.status === 200) {
                console.log("***** IN ZOHO GENERATE INVOICE : RESPONSE *****", response.data)
                await this.markInvoiceAsSend(invoice_id, storeValue);
                return {
                    invoice_id: invoice_id,
                    data: response.data
                };
            } else {
                console.error("Failed to fetch PDF invoice:", response.status);
                return null;
            }
        } catch (error) {
            console.error("Error fetching PDF invoice:", error);
            return null;
        }
    }

    async markInvoiceAsSend(invoice_id: string, value: any) {
        await this.getAccessTokenDB();
        const url = `/books/v3/invoices/${invoice_id}/status/sent?organization_id=${process.env.ZOHO_ORGANIZATION_ID}&invoice_ids=${invoice_id}`;
        try {
            const response = await (await this.client(value)).post(url);
            console.log("***** MARK INVOICE AS SEND RESPONSE : ", response);
            if (response.status === 200) {
                console.log("***** MARK INVOICE AS SEND : RESPONSE *****", response.data)
            }
        } catch (error) {
            console.error("Failed API MARK INVOICE AS SEND :", error);
            return null;
        }
    }


    addHours(hours) {
        const hoursToAdd = 3600000;
        let date = new Date();
        date.setTime(date.getTime() + hoursToAdd);
        return date.getTime().toString();
    }

    async client(authData: any) {
        console.log("***** ZOHO CLIENT: AUTH DATA IN ZOHO CLIENT *****", authData);
        let now = new Date();

        // Generate new token token not present
        if (authData.length === 0) {
            console.log("***** ZOHO CLIENT: IN TOKEN REFRESH CALL IN NO TOKEN EXISTS *****")
            authData = await this.generateAccessTokenFromRefreshToken()
        }


        // Generate token if expired
        if (authData.length > 0 && (now.getTime().toString() > authData[0].expires_in)) {
            console.log("***** ZOHO CLIENT: IN TOKEN REFRESH CALL IF TOKEN EXPIRED *****", authData, "***** TIME : ", now.getTime().toString())
            authData = await this.generateAccessTokenFromRefreshToken()
        }
        console.log("******* ZOHO CLIENT AUTH DATA ******", authData);
        if (authData.length > 0 && (now.getTime().toString() < authData[0].expires_in)) {
            return axios.create({
                baseURL: process.env.ZOHO_BASE_URL,
                headers: {
                    'content-type': 'application/json',
                    Authorization: `Zoho-oauthtoken ${authData[0].access_token}`,
                },
            })
        }

    }
}

export default ZohoService
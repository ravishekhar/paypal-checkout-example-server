import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import createOrder from "../order/create-order";
import captureOrder from "../order/capture-order";
import getOrder from "../order/get-order";
import products from "../data/products.json";
import config from "../config";
import { randomUUID } from "node:crypto";

import type {
  CreateOrderRequestBody,
  OrderResponseBody,
  PurchaseItem,
} from "@paypal/paypal-js";
import { setOrderCache } from "../cache/orderCache";

const {
  deploymentEnvironmentBaseUrl,
  paypal: {
    currency,
    intent,
    enableOrderCapture,
    enableShippingAddressCallback,
    enableShippingOptionsCallback,
    demo,
  },
} = config;

type CartItem = {
  sku: keyof typeof products;
  quantity: number;
};

function roundTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getItemsAndTotal(cart: CartItem[]): {
  itemsArray: PurchaseItem[];
  itemTotal: number;
} {
  // API reference: https://developer.paypal.com/docs/api/orders/v2/#orders_create!path=purchase_units/items&t=request
  const itemsArray = cart.map(({ sku, quantity = "1" }) => {
    // If limited inventory applies to your use case, this is normally tracked in a database alongside other product information
    // Static information from data/products.json is used here for demo purposes
    const { name, description, price, category, stock = "1" } = products[sku];
    if (stock < quantity)
      throw new Error(`${name} ${sku} (qty: ${quantity}) is out of stock.`);
    return {
      name,
      sku,
      description,
      category,
      quantity,
      unit_amount: {
        currency_code: currency,
        value: price,
      },
    } as PurchaseItem;
  });

  const itemTotal = itemsArray.reduce(
    (partialSum, item) =>
      partialSum + parseFloat(item.unit_amount.value) * parseInt(item.quantity),
    0
  );

  return { itemsArray, itemTotal: roundTwoDecimals(itemTotal) };
}

async function createOrderHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { cart, onCancelUrl, onApproveUrl, buyerEmail } = request.body as {
    cart: CartItem[];
    buyerEmail: string;
    onCancelUrl: string;
    onApproveUrl: string;
  };
  const { itemsArray, itemTotal } = getItemsAndTotal(cart);

  // Example shipping and tax calculation
  const shippingTotal = 0;
  const taxTotal = 0;
  const grandTotal = roundTwoDecimals(itemTotal + shippingTotal + taxTotal);

  // const invoiceId = "DEMO-INVNUM-" + Date.now(); // An optional transaction field value, use your existing system/business' invoice ID here or generate one sequentially

  const orderPayload: CreateOrderRequestBody = {
    // API reference: https://developer.paypal.com/docs/api/orders/v2/#orders_create
    intent: intent,
    purchase_units: [
      {
        reference_id: randomUUID(), // Ideally this needs to be the unique cart identifier / session id maintained in your system.
        amount: {
          currency_code: currency,
          value: String(grandTotal),
          breakdown: {
            item_total: {
              // Required when `items` array is also present
              currency_code: currency,
              value: String(itemTotal),
            },
            tax_total: {
              // Can be omitted if none
              currency_code: currency,
              value: String(taxTotal),
            },
            shipping: {
              currency_code: currency,
              value: String(shippingTotal),
            },
            handling: {
              currency_code: currency,
              value: String(0),
            },
            insurance: {
              currency_code: currency,
              value: String(0),
            },
            shipping_discount: {
              currency_code: currency,
              value: String(0),
            },
            discount: {
              currency_code: currency,
              value: String(0),
            },
          },
        },
        shipping: {
          // Thd shipping info has been added to show a demo of UPDATE_CONTACT_INFO
          // These are optional values, In an ideal scenario merchant can pass these values
          // if the merchant already has the value.
          // Else merchant can skip it.
          ...(demo.shippingEmail &&
          demo.shippingCountryCode &&
          demo.shippingPhone
            ? {
                email_address: demo.shippingEmail,
                phone_number: {
                  country_code: demo.shippingCountryCode,
                  national_number: demo.shippingPhone,
                },
              }
            : {}),
        },
        items:
          itemsArray /* Line item detail can be seen in the PayPal Checkout by clicking the amount in the upper-right, and is stored in the transaction record */,

        /* invoice_id: invoiceId,  /* Your own unique order #, will be indexed and stored as part of the transaction record and searchable in paypal.com account
                                                                                              (Must be unique, never used for an already *successful* transaction in the receiving account;
                                                                                              payment attempts with the invoice_id of a previously successful transaction are blocked to prevent accidental repeat payment for same thing) */

        // custom_id: "any-arbitrary-metadata-value",  /* Not indexed nor searchable, but value will be returned in all API or webhook responses and visible in the transaction record of *receiving* PayPal account */
      },
    ],
    payment_source: {
      paypal: {
        ...(buyerEmail ? { email_address: buyerEmail } : {}),
        experience_context: {
          user_action: "PAY_NOW",
          shipping_preference: "GET_FROM_FILE",
          return_url: onApproveUrl,
          cancel_url: onCancelUrl,
          // Refer https://developer.paypal.com/docs/checkout/standard/customize/contact-module/
          contact_preference: "UPDATE_CONTACT_INFO",
          ...(enableShippingAddressCallback
            ? {
                // https://developer.paypal.com/docs/checkout/standard/customize/shipping-module/
                order_update_callback_config: {
                  // You can subscribe to only SHIPPING_ADDRESS or both SHIPPING_ADDRESS and SHIPPING_OPTIONS based on your business needs
                  callback_events: enableShippingOptionsCallback
                    ? ["SHIPPING_ADDRESS", "SHIPPING_OPTIONS"]
                    : ["SHIPPING_ADDRESS"],
                  callback_url: new URL(
                    "/api/shipping-callback",
                    deploymentEnvironmentBaseUrl
                  ).href,
                },
              }
            : {}),
        },
      },
    },
  } as unknown as CreateOrderRequestBody; //cast needed for payment_source.paypal with paypal-js@5.1.4 as this version's type is not upto date

  console.log("Create Order Payload", JSON.stringify(orderPayload));

  const orderResponse = await createOrder({
    body: orderPayload,
    headers: { Prefer: "return=representation" },
  });

  if (orderResponse.status === "ok") {
    const { id, status } = orderResponse.data as OrderResponseBody;
    request.log.info({ id, status }, "order successfully created");
  } else {
    request.log.error(orderResponse.data, "failed to create order");
  }

  const token = orderResponse.data.id;
  setOrderCache(String(token), orderPayload);

  reply
    .code(orderResponse.httpStatusCode as number)
    .header("paypal-debug-id", orderResponse.paypalCorrelationId)
    .send(orderResponse.data);
}

async function captureOrderHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { orderID } = request.body as { orderID: string };
  if (!enableOrderCapture) {
    throw new Error("Capture order is not enabled!");
  }

  const responseData = await captureOrder(orderID);
  const { paypalCorrelationId } = responseData;
  const data = responseData?.data as OrderResponseBody;
  const transaction =
    data?.purchase_units?.[0]?.payments?.captures?.[0] ||
    data?.purchase_units?.[0]?.payments?.authorizations?.[0];

  if (!transaction?.id || transaction.status === "DECLINED") {
    console.warn(`PayPal API order ${orderID}: capture failed`, data);
  } else {
    console.info(
      `PayPal API order ${orderID}: successful capture`,
      transaction
    );
    // const capturedAmount = (<any>transaction?.amount)?.value;

    // Here you can add code to save the PayPal transaction.id in your records, perhaps calling an asynchronous database writer
    // (Most common use case is for your own record's id to be unique and map to the transaction.invoice_id you provided during creation)
    // Your code should validate the captured amount was as expected before doing anything automated for order fulfillment/delivery
    // (If the total was not as expected, you could flag the transacton in your system for manual review--or refund it)
  }

  // Finally, forward a result back to the frontend 'onApprove' callback--always forward a result, since the frontend must handle success/failure display
  reply
    .code(responseData.httpStatusCode as number)
    .header("paypal-debug-id", paypalCorrelationId)
    .send(data);
}

export async function createOrderController(fastify: FastifyInstance) {
  fastify.route({
    method: "POST",
    url: "/create-order",
    handler: createOrderHandler,
    schema: {
      body: {
        type: "object",
        required: ["cart", "onApproveUrl", "onCancelUrl"],
        properties: {
          cart: {
            type: "array",
            items: {
              type: "object",
              required: ["sku"],
              properties: {
                sku: { type: "string" },
                quantity: { type: "number" },
              },
            },
          },
          buyerEmail: {
            type: "string",
          },
          onApproveUrl: { type: "string" },
          onCancelUrl: { type: "string" },
        },
      },
    },
  });
}

export async function captureOrderController(fastify: FastifyInstance) {
  fastify.route({
    method: "POST",
    url: "/capture-order",
    handler: captureOrderHandler,
    schema: {
      body: {
        type: "object",
        required: ["orderID"],
        properties: {
          orderID: {
            type: "string",
          },
        },
      },
    },
  });
}

//get order details
async function getOrderHandler(request: FastifyRequest, reply: FastifyReply) {
  const { orderID } = request.query as { orderID: string };
  const { data, paypalCorrelationId } = await getOrder({ orderID });
  // Send only required data to web. This is a bad practice to send complete order response
  reply.header("paypal-debug-id", paypalCorrelationId).send(data);
}

export async function getOrderController(fastify: FastifyInstance) {
  fastify.route({
    method: "GET",
    url: "/get-order",
    handler: getOrderHandler,
    schema: {
      querystring: {
        type: "object",
        properties: {
          orderID: { type: "string" },
        },
      },
    },
  });
}

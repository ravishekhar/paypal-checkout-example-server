import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { PurchaseUnit } from "@paypal/paypal-js/types/apis/orders";

import config from "../config";
import { getOrderCache } from "../cache/orderCache";

export interface ShippingAddress {
  country_code: string;
  admin_area_1: string;
  admin_area_2: string;
  postal_code: string;
}

export interface ShippingOption {
  id: number;
  label: string;
  type: string;
  amount: {
    value: string;
    currency_code: string;
  };
  selected: boolean;
}

export interface ShippingCallbackInput {
  id: string;
  shipping_address: ShippingAddress;
  shipping_option?: ShippingOption;
  purchase_units: PurchaseUnit[];
}

/**
 * Refer to this document for more details on server side shipping callbacks
 * https://developer.paypal.com/docs/checkout/standard/customize/shipping-module/
 * @param request
 * @param reply
 */
async function handler(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as ShippingCallbackInput;
  const orderId = body.id;
  const currencyCode = config.paypal.currency;

  const orderRequest = getOrderCache(orderId);
  if (!orderRequest) {
    // This condition would never arise unless buyer is trying an expired token
    reply.send({
      name: "UNPROCESSABLE_ENTITY",
      details: [
        {
          issue: "METHOD_UNAVAILABLE",
        },
      ],
    });
    return;
  }

  // Be careful in logging in real application, it may contain buyer's PII information like data supplied during create order payload.
  console.log("ShippingCallbackReceived", JSON.stringify(body));
  // Calculate the correct shipping options and amount based on address provided in the input.
  // In this example values are simply hard coded.
  const shippingOptions = [
    {
      id: 1,
      amount: {
        currency_code: currencyCode,
        value: "0.00",
      },
      type: "SHIPPING",
      label: "Free Shipping",
      selected: true,
    },
    {
      id: 2,
      amount: {
        currency_code: currencyCode,
        value: "2.00",
      },
      type: "SHIPPING",
      label: "USPS Priority Shipping",
      selected: false,
    },
    {
      id: 3,
      amount: {
        currency_code: currencyCode,
        value: "3.00",
      },
      type: "SHIPPING",
      label: "1-Day Shipping",
      selected: false,
    },
  ];
  const amount = orderRequest.purchase_units[0].amount;

  // Required if we are subscribed to SHIPPING_OPTIONS callback as well
  if (body.shipping_option && amount.breakdown?.item_total) {
    console.log("Calculating amount based on shipping option selection");
    const selectedShippingOption = body.shipping_option;
    // If the Shipping Option is present, it means the user has made a selection to choose this shipping option.
    // Calculate the correct price based on this shipping option or decline if unsupported

    const itemTotal = Number(amount.breakdown.item_total.value as string);

    const taxTotal = Number((amount.breakdown.tax_total?.value as string) || 0);
    const shippingValue = Number(selectedShippingOption.amount.value);
    const totalValue = itemTotal + shippingValue + taxTotal;
    amount.breakdown.shipping = {
      value: String(shippingValue.toFixed(2)),
      currency_code: currencyCode,
    };

    amount.breakdown.tax_total = {
      value: String(taxTotal.toFixed(2)),
      currency_code: currencyCode,
    };

    amount.value = String(totalValue.toFixed(2));
    // Mark the one selected by buyer as selected option
    shippingOptions.forEach((option) => {
      option.selected = option.id === selectedShippingOption.id;
    });
  }

  const responseData = {
    id: orderId,
    purchase_units: [
      {
        amount: orderRequest.purchase_units[0].amount,
        reference_id: orderRequest.purchase_units[0].reference_id,
        shipping_options: shippingOptions,
      },
    ],
  };

  console.log("ShippingCallbackResponse", JSON.stringify(responseData));
  reply.send(responseData);
}

export async function shippingCallbackController(fastify: FastifyInstance) {
  fastify.route({
    method: "POST",
    url: "/shipping-callback",
    handler,
    schema: {
      body: {
        type: "object",
        required: ["id", "shipping_address"],
        properties: {
          id: {
            // The Order ID
            type: "string",
          },
          shipping_address: {
            type: "object",
            properties: {
              country_code: { type: "string" },
              admin_area_1: { type: "string" },
              admin_area_2: { type: "string" },
              postal_code: { type: "string" },
            },
          },
          shipping_option: {
            type: "object",
            required: ["id", "amount", "type", "label"],
            properties: {
              id: { type: "number" },
              amount: {
                type: "object",
                required: ["currency_code", "value"],
                properties: {
                  currency_code: { type: "string" },
                  value: { type: "number" },
                },
              },
              type: { type: "string" },
              label: { type: "string" },
            },
          },
          purchase_units: {
            type: "array",
          },
        },
      },
    },
  });
}

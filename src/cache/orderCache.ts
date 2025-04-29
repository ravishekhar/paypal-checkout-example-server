import Cache from "./index";
import { CreateOrderRequestBody } from "@paypal/paypal-js";

const CACHE_TIMEOUT = 3 * 60 * 60 * 1000; // 3 hours
const orderCache = new Cache();

export function setOrderCache(
  token: string,
  value: CreateOrderRequestBody
): void {
  orderCache.set(token, value, CACHE_TIMEOUT);
}

export function getOrderCache(
  token: string
): CreateOrderRequestBody | undefined {
  const value = orderCache.get(token);
  if (value) {
    return value as CreateOrderRequestBody;
  }
  return undefined;
}

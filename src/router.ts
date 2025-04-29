import type { FastifyInstance } from "fastify";
import {
  createOrderController,
  getOrderController,
  captureOrderController,
} from "./controller/order-controller";
import { configController } from "./controller/config-controller";
import { setErrorHandler } from "./controller/error-controller";
import { shippingCallbackController } from "./controller/shipping-callback";
import { productsController } from "./controller/catalog-controller";

export default async function router(fastify: FastifyInstance) {
  setErrorHandler(fastify);
  fastify.register(shippingCallbackController, { prefix: "/api" });
  fastify.register(productsController, { prefix: "/api" });
  fastify.register(createOrderController, { prefix: "/api/paypal" });
  fastify.register(captureOrderController, { prefix: "/api/paypal" });
  fastify.register(configController, { prefix: "/api/paypal" });
  fastify.register(getOrderController, { prefix: "/api/paypal" });
}

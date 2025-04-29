import products from "../data/products.json";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export async function productsController(fastify: FastifyInstance) {
  fastify.get(
    "/catalog/products",
    async function (_request: FastifyRequest, reply: FastifyReply) {
      reply.send(products);
    }
  );
}

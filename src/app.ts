import fastify, { FastifyServerOptions } from "fastify";
import fastifyStatic from "@fastify/static";
import cors from "@fastify/cors";
import path from "path";

import router from "./router";

export default function buildApp(options: FastifyServerOptions = {}) {
  const server = fastify(options);

  // Using origin: * is an insecure way to register cors. Do not use on Production. You must only allow trusted origins
  server.register(cors, {
    origin: [
      /localhost(:\d+)?$/,
      /merchant-client-application-357e4efe7e5e\.herokuapp\.com/,
    ],
  });
  server.register(router);

  server.register(fastifyStatic, {
    root: path.join(__dirname, "../", "public"),
  });

  return server;
}

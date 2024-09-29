import { ServerRunner, ConsoleStrategy } from "microservice-framework";
import { WebsocketService, WebsocketServiceConfig } from "./WebsocketsService";
import { AWSBackend } from "../../aws-backend/AWSBackend";

const namespace = "sage-bot";
const serviceId = "websockets";
const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");
const WS_PORT = parseInt(process.env.WS_PORT || "8080");

if (!REDIS_HOST) {
  throw new Error("environment variable is not set");
}

const config: WebsocketServiceConfig = {
  namespace,
  concurrencyLimit: 100,
  requestsPerInterval: 100,
  tpsInterval: 1000,
  serviceId,
  wsport: WS_PORT,
  authToken: "AskTheExpert",
  logStrategy: new ConsoleStrategy(),
};

const backend = new AWSBackend(namespace, {
  host: REDIS_HOST,
  port: REDIS_PORT,
});

const websockets = new WebsocketService(backend, config);
const server = new ServerRunner(websockets);
server.start();

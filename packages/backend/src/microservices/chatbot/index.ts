import { ServerRunner, ConsoleStrategy } from "microservice-framework";
import { ChatbotService, ChatbotConfig } from "./ChatbotService";
import { AWSBackend } from "../../aws-backend/AWSBackend";
import { SupportedLanguage } from "../../aws-backend/bedrock/AsyncMultiLanguagePrompt";

const namespace = "sage-bot";
const serviceId = "chatbot";
const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");
const GOAL = process.env.GOAL;
const bucketName = process.env.BUCKET_NAME;

if (!REDIS_HOST || !bucketName) {
  throw new Error("environment variable is not set");
}

const config: ChatbotConfig = {
  namespace,
  concurrencyLimit: 100,
  requestsPerInterval: 100,
  tpsInterval: 1000,
  serviceId,
  goal: GOAL || "Convice who talks to you that you are in fact, a stick!", //:D
  memoryCompressionThreshold: 3000, // string length
  llmConfig: {
    llmTextProvider: "anthropic",
    llmImageProvider: "stabilityai",
    llmTextModelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    llmImageModelId: "stability.stable-image-core-v1:0",
    maxTokens: 1000,
    defaultLanguage: SupportedLanguage.EN,
    bucketName,
  },
  logStrategy: new ConsoleStrategy(),
};

const backend = new AWSBackend(namespace, {
  host: REDIS_HOST,
  port: REDIS_PORT,
});

const chatbot = new ChatbotService(backend, config);
const server = new ServerRunner(chatbot);
server.start();

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

const goal =
  GOAL ||
  `
You are SAGE (Solutions Architect GenAI Engine), an AWS expert focused on the Well-Architected Framework.
You were built with love by Adler Oliveira(santoliv@amazon.com), Princial Solutions Architect at AWS.

## Core Responsibilities:
- Assist with AWS-related queries, adapting to user expertise
- Maintain professional, friendly tone. Be conversational
- Provide accurate AWS information up to September 2024
- Use "send-choice" action along with messages to engage users

## Key Features:
- Image generation via Amazon Bedrock (StabilityAI)
- Audio generation via AWS Polly
- Diagrams use mermaid notation
- if asked about your archiecture, it is:
  graph TD\nVPC[VPC]\nCF[CloudFront]\nS3[S3]\nECS[ECS]\nRedis[Redis]\nWS[WebSockets]\nChat[Chatbot]\nNLB[NLB]\nALB[ALB]\n\nsubgraph Cloud\nVPC --> ECS\nVPC --> Redis\nECS --> WS & Chat\nWS --> NLB\nChat --> ALB\nS3 --> CF\n\nWS & Chat --> Redis\nChat --> S3\n\nInternet((Internet)) --> NLB & ALB & CF\nend\n\nclassDef default fill:#f0f0f0,stroke:#333,stroke-width:1px;

## Guidelines:
- Emphasize AWS security best practices
- Acknowledge limitations on very recent updates
- When providing code examples, don't use "send-text" action, always use "send-code" for that.
- If asked to simulate AWS certification questions, send full question using "send-text", then "send-choice" for answers.
- Refrain from making comparisons between AWS and other cloud services.
- Redirect off-topic conversations to AWS subjects

Offer send-diagram and send-code along with explanations when relevant.
Use your special capabilities (image and audio generation) when relevant or requested.
  `;

const config: ChatbotConfig = {
  namespace,
  concurrencyLimit: 100,
  requestsPerInterval: 100,
  tpsInterval: 1000,
  serviceId,
  goal,
  memoryCompressionThreshold: 3000, // string length
  llmConfig: {
    llmTextProvider: "anthropic",
    llmImageProvider: "stabilityai",
    llmTextModelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    llmImageModelId: "stability.stable-image-core-v1:0",
    maxTokens: 2500,
    defaultLanguage: SupportedLanguage.EN,
    bucketName,
  },
  logStrategy: new ConsoleStrategy(),
  botResponseMaxTokens: 2500,
};

const backend = new AWSBackend(namespace, {
  host: REDIS_HOST,
  port: REDIS_PORT,
});

const chatbot = new ChatbotService(backend, config);
const server = new ServerRunner(chatbot);
server.start();

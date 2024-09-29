import { IBackEnd, ITable } from "microservice-framework";
import { RedisPubSubStrategy } from "./RedisPubSubStrategy";
import { RedisPubSubClient } from "./RedisPubSubClient";
import { RedisServiceRegistry } from "./RedisServiceRegistry";
import { RedisStorageStrategy } from "./RedisStorageStrategy";
import { RedisTable } from "./RedisTable";
import Redis, { RedisOptions } from "ioredis";
import { ChatbotBackend } from "../microservices/chatbot/ChatbotService";

export class AWSBackend implements ChatbotBackend {
  tables: Map<string, ITable> = new Map();
  pubSubConsumer: RedisPubSubStrategy;
  serviceRegistry: RedisServiceRegistry;
  private redisOptions: RedisOptions;
  private redisPubSubClient: RedisPubSubClient;
  private redisStorageStrategy: RedisStorageStrategy;
  private redisClient: Redis;
  private started: boolean = false;

  constructor(private namespace: string, redisOptions: RedisOptions) {
    this.redisOptions = redisOptions;
    this.redisPubSubClient = new RedisPubSubClient(redisOptions);
    this.redisClient = new Redis(this.redisOptions);
    this.pubSubConsumer = new RedisPubSubStrategy(this.redisPubSubClient);
    this.redisStorageStrategy = new RedisStorageStrategy(this.redisClient);
    this.serviceRegistry = new RedisServiceRegistry(
      this.redisStorageStrategy,
      namespace
    );
    this.start();
  }

  async start() {
    await this.pubSubConsumer.start();
    this.started = true;
  }

  async stop() {
    await this.pubSubConsumer.stop();
    this.started = false;
  }

  createTable(name: string): ITable<any> {
    const table = new RedisTable(this.redisStorageStrategy, name);
    this.tables.set(name, table);
    return table;
  }

  getTable(name: string): ITable<any> | undefined {
    return this.tables.get(name);
  }
}

import Redis, { RedisOptions } from "ioredis";
import { Loggable, IPubSubClient } from "microservice-framework";

export class RedisPubSubClient extends Loggable implements IPubSubClient {
  private subClient: Redis;
  private pubClient: Redis;
  private subscribedChannels: Set<string> = new Set();

  constructor(options: RedisOptions) {
    super();
    this.subClient = new Redis(options);
    this.pubClient = new Redis(options);
  }

  async subscribe(channel: string): Promise<void> {
    if (!this.subscribedChannels.has(channel)) {
      await this.subClient.subscribe(channel);
      this.subscribedChannels.add(channel);
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    if (this.subscribedChannels.has(channel)) {
      await this.subClient.unsubscribe(channel);
      this.subscribedChannels.delete(channel);
    }
  }

  async publish(channel: string, message: any): Promise<void> {
    await this.pubClient.publish(channel, JSON.stringify(message));
  }

  onMessage(callback: (channel: string, message: string) => void): void {
    this.subClient.on("message", callback);
  }

  onError(callback: (error: Error) => void): void {
    this.subClient.on("error", (error) => callback(error));
    this.pubClient.on("error", (error) => callback(error));
  }

  removeAllListeners(): void {
    this.subClient.removeAllListeners();
    this.pubClient.removeAllListeners();
  }

  // TODO: Remove this method after refactoring
  public getRawRedisClient(): Redis {
    return this.subClient;
  }

  async close(): Promise<void> {
    await this.subClient.quit();
    await this.pubClient.quit();
  }
}

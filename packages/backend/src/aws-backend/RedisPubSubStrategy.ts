import {
  IRequest,
  IResponse,
  IMessage,
  PubSubConsumer,
  PubSubConsumerOptions,
  MessageHandler,
} from "microservice-framework";
import { RedisPubSubClient } from "./RedisPubSubClient";

type RedisMessage = IRequest<any> | IResponse<any>;

export class RedisPubSubStrategy extends PubSubConsumer<RedisMessage> {
  private redisClient: RedisPubSubClient;

  constructor(
    redisClient: RedisPubSubClient,
    options: PubSubConsumerOptions = {}
  ) {
    super(redisClient, options);
    this.redisClient = redisClient;
  }

  async start(): Promise<void> {
    if (this.isRunning()) {
      return;
    }

    try {
      await super.start();

      this.redisClient.onMessage((channel, message) => {
        try {
          const parsedMessage = JSON.parse(message) as RedisMessage;

          const handler = this.subscribedChannels.get(channel);
          if (handler) {
            handler(parsedMessage);
          }

          this.emit("message", channel, parsedMessage);
        } catch (error: any) {
          console.error(`Failed to parse message: ${error.message}`);
          this.emit(
            "error",
            new Error(`Failed to parse message: ${error.message}`)
          );
        }
      });

      this.redisClient.onError((error) => {
        console.error(`Redis client error: ${error.message}`);
        this.emit("error", error);
      });
    } catch (error: any) {
      console.error(`Failed to start Redis consumer: ${error.message}`);
      throw new Error(`Failed to start Redis consumer: ${error.message}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning()) {
      return;
    }

    try {
      await super.stop();
      this.redisClient.removeAllListeners();
    } catch (error: any) {
      console.error(`Failed to stop Redis consumer: ${error.message}`);
      throw new Error(`Failed to stop Redis consumer: ${error.message}`);
    }
  }

  protected async setupChannelHandler(
    channel: string,
    handler: MessageHandler<RedisMessage>
  ): Promise<void> {
    await this.redisClient.subscribe(channel);
  }

  protected generateMessageId(message: RedisMessage): string {
    if (this.isRequest(message)) {
      return `${message.header.requestId}-${message.header.timestamp}`;
    } else {
      return `${message.requestHeader.requestId}-${message.responseHeader.timestamp}`;
    }
  }

  private isRequest(message: RedisMessage): message is IRequest<any> {
    return "header" in message && "body" in message;
  }

  async unsubscribeFromChannel(channel: string): Promise<void> {
    await this.redisClient.unsubscribe(channel);
    this.subscribedChannels.delete(channel);
  }

  async publish(channel: string, message: RedisMessage): Promise<void> {
    await this.redisClient.publish(channel, message);
  }
}

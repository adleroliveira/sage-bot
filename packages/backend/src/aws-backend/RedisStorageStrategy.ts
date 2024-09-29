import Redis from "ioredis";
import { IStorageStrategy } from "microservice-framework";

export class RedisStorageStrategy implements IStorageStrategy {
  constructor(public client: Redis) {}

  async get(key: string): Promise<any | null> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: any): Promise<void> {
    await this.client.set(key, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async update(key: string, field: string, value: any): Promise<void> {
    await this.client.hset(key, field, JSON.stringify(value));
  }

  async append(key: string, value: any): Promise<void> {
    await this.client.rpush(key, JSON.stringify(value));
  }

  async getAll(pattern: string): Promise<Map<string, any>> {
    const keys = await this.client.keys(pattern);
    const result = new Map<string, any>();
    for (const key of keys) {
      const value = await this.get(key);
      result.set(key, value);
    }
    return result;
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async addToSortedSet(
    key: string,
    score: number,
    member: string
  ): Promise<void> {
    await this.client.zadd(key, score, member);
  }

  async removeFromSortedSet(key: string, member: string): Promise<void> {
    await this.client.zrem(key, member);
  }

  async getRangeFromSortedSet(
    key: string,
    start: number,
    stop: number
  ): Promise<string[]> {
    return this.client.zrange(key, start, stop);
  }

  async getRangeWithScoresFromSortedSet(
    key: string,
    start: number,
    stop: number
  ): Promise<Array<{ member: string; score: number }>> {
    const result = await this.client.zrange(key, start, stop, "WITHSCORES");

    const parsedResult: Array<{ member: string; score: number }> = [];
    for (let i = 0; i < result.length; i += 2) {
      parsedResult.push({
        member: result[i],
        score: parseFloat(result[i + 1]),
      });
    }

    return parsedResult;
  }

  async addToList(key: string, value: any): Promise<void> {
    await this.client.rpush(key, JSON.stringify(value));
  }

  async getListItems(key: string, start: number, stop: number): Promise<any[]> {
    const items = await this.client.lrange(key, start, stop);
    return items.map((item) => JSON.parse(item));
  }

  async removeFromList(key: string, value: any): Promise<void> {
    await this.client.lrem(key, 0, JSON.stringify(value));
  }
}

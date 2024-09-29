import { RedisStorageStrategy } from "./RedisStorageStrategy";
import { ISortedSet } from "microservice-framework";

export class RedisSortedSet<T = any> implements ISortedSet<T> {
  constructor(private storage: RedisStorageStrategy, private prefix: string) {}

  private prefixKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async add(key: string, score: number, member: T): Promise<void> {
    await this.storage.client.zadd(
      this.prefixKey(key),
      score,
      JSON.stringify(member)
    );
  }

  async remove(key: string, member: T): Promise<void> {
    await this.storage.client.zrem(this.prefixKey(key), JSON.stringify(member));
  }

  async getRange(key: string, start: number, stop: number): Promise<T[]> {
    const result = await this.storage.client.zrange(
      this.prefixKey(key),
      start,
      stop
    );
    return result.map((item) => JSON.parse(item));
  }

  async getRangeWithScores(
    key: string,
    start: number,
    stop: number
  ): Promise<Array<{ member: T; score: number }>> {
    const result = await this.storage.client.zrange(
      this.prefixKey(key),
      start,
      stop,
      "WITHSCORES"
    );
    const parsedResult: Array<{ member: T; score: number }> = [];
    for (let i = 0; i < result.length; i += 2) {
      parsedResult.push({
        member: JSON.parse(result[i]),
        score: parseFloat(result[i + 1]),
      });
    }
    return parsedResult;
  }

  async getScore(key: string, member: T): Promise<number | null> {
    const score = await this.storage.client.zscore(
      this.prefixKey(key),
      JSON.stringify(member)
    );
    return score !== null ? parseFloat(score) : null;
  }

  async incrementScore(
    key: string,
    member: T,
    increment: number
  ): Promise<number> {
    const newScore = await this.storage.client.zincrby(
      this.prefixKey(key),
      increment,
      JSON.stringify(member)
    );
    return parseFloat(newScore);
  }

  async count(key: string): Promise<number> {
    return this.storage.client.zcard(this.prefixKey(key));
  }

  async getAllKeys(): Promise<string[]> {
    const keys = await this.storage.client.keys(`${this.prefix}:*`);
    return keys.map((key) => key.slice(this.prefix.length + 1));
  }
}

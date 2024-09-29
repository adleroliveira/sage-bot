import { RedisStorageStrategy } from "./RedisStorageStrategy";
import { ITable } from "microservice-framework";

export class RedisTable<T = any> implements ITable<T> {
  constructor(private storage: RedisStorageStrategy, private prefix: string) {}

  private prefixKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get(key: string): Promise<T | null> {
    return this.storage.get(this.prefixKey(key));
  }

  async set(key: string, value: T): Promise<void> {
    await this.storage.set(this.prefixKey(key), value);
  }

  async delete(key: string): Promise<void> {
    await this.storage.delete(this.prefixKey(key));
  }

  async update(key: string, field: string, value: any): Promise<void> {
    await this.storage.update(this.prefixKey(key), field, value);
  }

  async getAll(): Promise<Map<string, T>> {
    const result = await this.storage.getAll(`${this.prefix}:*`);
    const cleanResult = new Map<string, T>();
    for (const [key, value] of result.entries()) {
      cleanResult.set(key.slice(this.prefix.length + 1), value as T);
    }
    return cleanResult;
  }

  async exists(key: string): Promise<boolean> {
    return this.storage.exists(this.prefixKey(key));
  }
}

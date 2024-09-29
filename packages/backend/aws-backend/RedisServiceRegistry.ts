import { RedisSortedSet } from "./RedisSortedSet";
import { RedisStorageStrategy } from "./RedisStorageStrategy";
import { IServiceRegistry, ISortedSet } from "microservice-framework";

export class RedisServiceRegistry implements IServiceRegistry {
  private sortedSet: ISortedSet<string>;
  private serviceKeyPrefix: string;

  constructor(
    private storage: RedisStorageStrategy,
    private namespace: string
  ) {
    this.sortedSet = new RedisSortedSet<string>(storage, namespace);
    this.serviceKeyPrefix = `${namespace}:service:`;
  }

  async registerService(
    serviceId: string,
    nodeId: string,
    load: number
  ): Promise<void> {
    await this.sortedSet.add(this.getServiceKey(serviceId), load, nodeId);
  }

  async deregisterService(serviceId: string, nodeId: string): Promise<void> {
    await this.sortedSet.remove(this.getServiceKey(serviceId), nodeId);
    console.log("deregistered", serviceId, nodeId);
  }

  async updateServiceLoad(
    serviceId: string,
    nodeId: string,
    load: number
  ): Promise<void> {
    await this.sortedSet.add(this.getServiceKey(serviceId), load, nodeId);
  }

  async getLeastLoadedNode(serviceId: string): Promise<string | null> {
    const result = await this.sortedSet.getRange(
      this.getServiceKey(serviceId),
      0,
      0
    );
    return result.length > 0 ? result[0] : null;
  }

  async getAllNodes(
    serviceId: string
  ): Promise<Array<{ nodeId: string; load: number }>> {
    const result = await this.sortedSet.getRangeWithScores(
      this.getServiceKey(serviceId),
      0,
      -1
    );
    return result.map(({ member, score }) => ({
      nodeId: member,
      load: score,
    }));
  }

  async getOnlineServices(): Promise<string[]> {
    const allKeys = await this.sortedSet.getAllKeys();
    return allKeys
      .filter((key) => key.startsWith(this.serviceKeyPrefix))
      .map((key) => key.slice(this.serviceKeyPrefix.length));
  }

  async isServiceOnline(serviceId: string): Promise<boolean> {
    const nodes = await this.getAllNodes(serviceId);
    return nodes.length > 0;
  }

  private getServiceKey(serviceId: string): string {
    return `${this.serviceKeyPrefix}${serviceId}`;
  }
}

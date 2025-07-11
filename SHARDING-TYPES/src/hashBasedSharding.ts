import { ShardConfig } from "./config/Sharding";

export class HashBasedSharding {
    static readonly SHARDS: ShardConfig[] = [
        {
            name: 'shard1',
            partitions: ['partition1'],
            primary: 'shard1-primary',
            replica: 'shard1-replica',
            weight: 33
        },
        {
            name: 'shard2',
            partitions: ['partition2'],
            primary: 'shard2-primary',
            replica: 'shard2-replica',
            weight: 33
        },
        {
            name: 'shard3',
            partitions: ['partition3'],
            primary: 'shard3-primary',
            replica: 'shard3-replica',
            weight: 34
        }
    ];
    private static hashKey(key: string): number {
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            const char = key.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
    static getShardByKey(key: string): ShardConfig {
        const hash = this.hashKey(key);
        const shardIndex = hash % this.SHARDS.length;
        return this.SHARDS[shardIndex];
    }
    static getShardIndex(key: string): number {
        const hash = this.hashKey(key);
        return hash % this.SHARDS.length;
    }
}
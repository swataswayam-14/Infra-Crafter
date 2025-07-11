import { ShardConfig } from "./config/Sharding";

export class DirectoryBasedSharding {
    static readonly SHARDS: ShardConfig[] = [
        {
            name: 'shard1',
            partitions: ['users1', 'orders1'],
            primary: 'shard1-primary',
            replica: 'shard1-replica',
            weight: 40
        },
        {
            name: 'shard2',
            partitions: ['users2', 'orders2'],
            primary: 'shard2-primary',
            replica: 'shard2-replica',
            weight: 35
        },
        {
            name: 'shard3',
            partitions: ['users3', 'orders3'],
            primary: 'shard3-primary',
            replica: 'shard3-replica',
            weight: 25
        }
    ];
    // Directory mapping - in production, this would be in a database
    private static directory = new Map<string, string>([
        ['user:1', 'shard1'],
        ['user:2', 'shard2'],
        ['user:3', 'shard1'],
        ['user:4', 'shard3'],
        ['order:1001', 'shard1'],
        ['order:1002', 'shard2'],
        ['order:1003', 'shard3']
    ]);

    static getShardByKey(key: string): ShardConfig {
        const shardName = this.directory.get(key);
        if (shardName) {
            const shard = this.SHARDS.find(s => s.name === shardName);
            if (shard) return shard;
        }
        return this.assignToLeastLoadedShard(key);
    }
    static assignToLeastLoadedShard(key: string): ShardConfig {
        const leastLoadedShard = this.SHARDS.reduce((prev, curr) => 
            prev.weight < curr.weight ? prev : curr
        );
        this.directory.set(key, leastLoadedShard.name);
        return leastLoadedShard;
    }
    static updateShardMapping(key: string, shardName: string): boolean {
        const shard = this.SHARDS.find(s => s.name === shardName);
        if (shard) {
            this.directory.set(key, shardName);
            return true;
        }
        return false;
    }

    static getDirectoryEntries(): Map<string, string> {
        return new Map(this.directory);
    }
}
import { ShardConfig } from "./config/Sharding";

export class RangeBasedSharding {
    static readonly SHARDS: ShardConfig[] = [
        {
            name: 'shard1',
            partitions: ['A-F'],
            primary: 'shard1-primary',
            replica: 'shard1-replica',
            weight: 33
        },
        {
            name: 'shard2',
            partitions: ['G-M'],
            primary: 'shard2-primary',
            replica: 'shard2-replica',
            weight: 33
        },
        {
            name: 'shard3',
            partitions: ['N-Z'],
            primary: 'shard3-primary',
            replica: 'shard3-replica',
            weight: 34
        }
    ]
    static readonly RANGES = [
        {
            start: 'A',
            end: 'F',
            shard: 'shard1'
        },
        {
            start: 'G',
            end: 'M',
            shard: 'shard2'
        },
        {
            start: 'N',
            end: 'Z',
            shard: 'shard3'
        }
    ];
    static getShardByKey(key: string): ShardConfig {
        const firstChar = key.charAt(0).toUpperCase();
        for (const range of this.RANGES) {
            if (firstChar >= range.start && firstChar <= range.end) return this.SHARDS.find(s => s.name === range.shard)!
        }
        return this.SHARDS[0];
    }
    static getShardsByRange (startKey: string,endKey: string): ShardConfig[] {
        const startChar = startKey.charAt(0).toUpperCase();
        const endChar = endKey.charAt(0).toUpperCase();
        const affectedShards: ShardConfig[] = [];

        for(const range of this.RANGES) {
            if(!(endChar < range.start) || (startChar > range.end)) {
                const shard = this.SHARDS.find(s => s.name === range.shard);
                if(shard) affectedShards.push(shard);
            }
        }
        return affectedShards;
    }
}
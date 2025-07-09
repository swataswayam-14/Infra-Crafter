export interface ShardConfig {
    name: string;
    partitions: string[];
    primary: string;
    replica: string;
    weight: number;
}
export interface PartitionConfig {
    name: string;
    size: number; //in MB
    shard: string;
    keyRange?: {
        start: string;
        end: string;
    };
}

export class ShardingConfig {
    static readonly PARTITIONS: PartitionConfig[] = [
        {
            name: 'A',
            size: 30,
            shard: 'shard1'
        },
        {
            name: 'B',
            size: 20,
            shard: 'shard1'
        },
        {
            name: 'C',
            size: 15,
            shard: 'shard3'
        },
        {
            name: 'D',
            size: 25,
            shard: 'shard2'
        },
        {
            name: 'E',
            size: 10,
            shard: 'shard3'
        }
    ];
    static readonly SHARDS: ShardConfig[] = [
        {
            name: 'shard1',
            partitions: ['A','B'],
            primary: 'shard1-primary',
            replica: 'shard1-replica',
            weight: 50
        },
        {
            name: 'shard2',
            partitions: ['D'],
            primary: 'shard2-primary',
            replica: 'shard2-replica',
            weight: 25
        }, 
        {
            name: 'shard3',
            partitions: ['C', 'E'],
            primary: 'shard3-primary',
            replica: 'shard3-replica',
            weight: 25
        }
    ]
    static getShardByPartition(partition: string): ShardConfig | undefined {
        return this.SHARDS.find(shard => shard.partitions.includes(partition))
    }

    private static hashKey(key: string): number {
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            const char = key.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    static getShardByKey(key: string) : ShardConfig {
        const hash = this.hashKey(key);
        const totalWeight = this.SHARDS.reduce((sum, shard) => sum + shard.weight, 0);
        const normalisedWeight = hash % totalWeight;

        let currWeight = 0;
        for(const shard of this.SHARDS) {
            currWeight += shard.weight;
            if(normalisedWeight < currWeight) return shard;
        }
        return this.SHARDS[0]; //fallback
    }
    //weighted based routing : this gives us : 1. even load (users are spread based on weight of the shard) , 2. same user always goes to the same shard
    // if we want to give more power to shard2 then just increase its weight
}
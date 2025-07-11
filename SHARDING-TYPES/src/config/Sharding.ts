export interface ShardConfig {
    name: string;
    partitions: string[];
    primary: string;
    replica: string;
    weight: number;
}

export interface PartitionConfig {
    name: string;
    size: number;
    shard: string;
    keyRange?: {
        start: string;
        end: string;
    }
}
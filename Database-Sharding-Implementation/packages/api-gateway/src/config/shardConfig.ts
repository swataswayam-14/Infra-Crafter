export interface Shard {
    id:number;
    primary: {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
    };
    replica?: {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
    };
    partitions: string[];
}

export interface Partition {
    id: string;
    sizeMB: number;
    shardId: number;
    routingStrategy: 'horizontal' | 'vertical';
}

export const shards: Shard[] = [
    {
        id: 1,
        primary: {
            host: 'shard1-primary',
            port: 5432,
            database: 'shard1',
            user:'postgres',
            password: 'postgres',
        },
        replica :{
            host: 'shard1-replica',
            port: 5432,
            database: 'shard1',
            user: 'postgres',
            password: 'postgres',
        },
        partitions: ['A', 'B'],
    },
    {
        id: 2,
        primary: {
            host: 'shard2-primary',
            port: 5432,
            database: 'shard2',
            user: 'postgres',
            password: 'postgres',
        },
        replica : {
            host: 'shard2-replica',
            port: 5432,
            database: 'shard2',
            user: 'postgres',
            password: 'postgres',
        },
        partitions: ['D']
    },
    {
        id: 2, 
        primary:{
            host:'shard3-primary',
            port: 5432,
            database: 'shard3',
            user: 'postgres',
            password: 'postgres',
        },
        replica : {
            host: 'shard3-replica',
            port: 5432,
            database : 'shard3',
            user: 'postgres',
            password: 'postgres',
        },
        partitions: ['C', 'E']
    }
];

export const partitions: Partition[] = [
    {
        id:'A',
        sizeMB: 30,
        shardId : 1,
        routingStrategy: 'horizontal',
    },
    {
        id: 'B',
        sizeMB: 20,
        shardId: 1,
        routingStrategy: 'horizontal',
    },
    {
        id: 'C',
        sizeMB: 15,
        shardId: 3,
        routingStrategy: 'vertical',
    },
    {
        id: 'D',
        sizeMB: 25,
        shardId: 2,
        routingStrategy: 'vertical',
    },
    {
        id: 'E',
        sizeMB: 10,
        shardId: 3,
        routingStrategy  : 'horizontal'
    }
]

export const getShardForPartition = (partitionId: string): Shard => {
    const partition = partitions.find( p => p.id === partitionId);
    if(!partition) throw new Error(`Partition ${partitionId} does not exist`);

    const shard = shards.find(s => s.id === partition.shardId);

    if(!shard) throw new Error(`Shard for partition ${partitionId} not found`);
    return shard;
}

export const getShardById = (shardId: number) : Shard => {
    const shard = shards.find(s => s.id === shardId);
    if(!shard) throw new Error(`Shard with ShardId:  ${shardId} not found`);
    return shard;
}
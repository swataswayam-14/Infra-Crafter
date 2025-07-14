import { ShardConfig } from "./config/Sharding";

export class ConsistentHashing {
    static readonly SHARDS: ShardConfig[] = [
        {
            name: 'shard1',
            partitions: ['ring1'],
            primary: 'shard1-primary',
            replica: 'shard1-replica',
            weight: 50
        },
        {
            name: 'shard2',
            partitions: ['ring2'],
            primary: 'shard2-primary',
            replica: 'shard2-replica',
            weight: 30
        },
        {
            name: 'shard3',
            partitions: ['ring3'],
            primary: 'shard3-primary',
            replica: 'shard3-replica',
            weight: 20
        }
    ];
    private static readonly VIRTUAL_NODES = 150;
    private static ring: Map<number, ShardConfig> =  new Map();
    private static initialised = false;

    private static hashKey(key:string): number {
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            const char  = key.charCodeAt(i);
            hash = ((hash << 5)- hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    private static initializeRing(): void {
        if(this.initialised) return;
        this.ring.clear();

        for(const shard of this.SHARDS) {
            const virtualNodeCount = Math.floor(this.VIRTUAL_NODES * (shard.weight / 100));
            for (let i=0; i<virtualNodeCount; i++) {
                const virtualNodeKey = `${shard.name}-${i}`;
                const hash = this.hashKey(virtualNodeKey);
                this.ring.set(hash, shard);
            }
        }
        this.initialised = true;
    }
    static getShardByKey(key: string): ShardConfig {
        this.initializeRing();

        const hash = this.hashKey(key);
        const sortedHashes = Array.from(this.ring.keys()).sort((a,b) => a-b);
        for (const ringHash of sortedHashes) {
            if (ringHash >= hash) return this.ring.get(ringHash)!;
        }
        return this.ring.get(sortedHashes[0])!;
    }
    static addShard(shard: ShardConfig): void {
        this.SHARDS.push(shard);
        this.initialised = false; //reinitialise
    }
    static removeShard(shardName: string): void {
        const index = this.SHARDS.findIndex( s => s.name === shardName);
        if(index > -1) {
            this.SHARDS.splice(index, 1);
            this.initialised = false; // reinitialise
        }
    }
    static getRingDistribution(): Map<number, string> {
        this.initializeRing();
        const distribution = new Map<number, string>();
        for(const [hash, shard] of this.ring) {
            distribution.set(hash, shard.name);
        }
        return distribution;
    }
}
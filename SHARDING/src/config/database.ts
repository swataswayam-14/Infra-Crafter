import { Pool, PoolClient } from "pg";

export interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
}

export class DatabaseManager {
    private pools: Map<String, Pool> = new Map();

    constructor() {
        this.initializePools();
    }
    private initializePools():void {
        this.pools.set('shard1-primary', new Pool({
            host: 'localhost',
            port: 5432,
            database: 'shard1',
            user: 'postgres',
            password: 'password',
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        }));
        this.pools.set('shard1-replica', new Pool({
            host: 'localhost',
            port: 5433,
            database: 'shard1',
            user: 'postgres',
            password: 'password',
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        }));
        this.pools.set('shard2-primary', new Pool({
            host: 'localhost',
            port: 5434,
            database: 'shard2',
            user: 'postgres',
            password: 'password',
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        }));
        this.pools.set('shard2-replica', new Pool({
            host: 'localhost',
            port: 5435,
            database: 'shard2',
            user: 'postgres',
            password: 'password',
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        }));
        this.pools.set('shard3-primary', new Pool({
            host: 'localhost',
            port: 5436,
            database: 'shard3',
            user: 'postgres',
            password: 'password',
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        }));
        this.pools.set('shard3-replica', new Pool({
            host: 'localhost',
            port: 5437,
            database: 'shard3',
            user: 'postgres',
            password: 'password',
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        }));
    }
    async getConnection(shardKey: string): Promise<PoolClient> {
        const pool = this.pools.get(shardKey);
        if(!pool) throw new Error(`Shard ${shardKey} not found`);
        return pool.connect();
    }
    async closeAll(): Promise<void> {
        const closePromises = Array.from(this.pools.values()).map(pool => pool.end);
        await Promise.all(closePromises);
    }
}
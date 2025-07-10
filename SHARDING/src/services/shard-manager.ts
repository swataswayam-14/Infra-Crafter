import { DatabaseManager } from "../config/database";
import { ShardingConfig, ShardConfig } from "../config/sharding";
import { AnalyticsService } from "./analytics";

export interface WriteRequest {
    table: string;
    data: any;
    shardKey: string;
}

export interface ReadRequest {
    table: string;
    query: string;
    params: any[];
    shardKey?: string;
}

export class ShardManager {
    private dbManager: DatabaseManager;
    private analytics: AnalyticsService;

    constructor(dbManager:DatabaseManager, analytics: AnalyticsService) {
        this.dbManager = dbManager;
        this.analytics = analytics;
    }
    async write(request: WriteRequest): Promise<any> {
        const startTime = Date.now();
        try {
            const shard = ShardingConfig.getShardByKey(request.shardKey);
            const connection = await this.dbManager.getConnection(shard.primary);
            const columns = Object.keys(request.data).join(', ');
            const values = Object.values(request.data);

            const placeholders = values.map((_,i) => `$${i+1}`).join(', ');
            const query = `INSERT INTO ${request.table} (${columns}) VALUES (${placeholders}) RETURNING *`;

            const result = await connection.query(query, values);
            connection.release();

            this.analytics.recordWrite(shard.name, Date.now() - startTime);

            return result.rows[0];
        } catch (error) {
            this.analytics.recordError('write', error as Error);
            throw error;
        }
    }

    async read(request: ReadRequest): Promise<any[]> {
        const startTime = Date.now();
        try {
            let shard: ShardConfig;
            if (!request.query.trim().toUpperCase().startsWith('SELECT')) {
                throw new Error('Only SELECT queries are allowed.');
            }
            if(request.shardKey) {
                shard = ShardingConfig.getShardByKey(request.shardKey);
            } else {
                //query all the shards
                return await this.readFromAllShards(request);
            }
            const connection = await this.dbManager.getConnection(shard.replica);
            const result = await connection.query(request.query, request.params);
            connection.release();

            this.analytics.recordRead(shard.name, Date.now()-startTime);

            return result.rows;
        } catch (error) {
            this.analytics.recordError('read', error as Error);
            throw error;
        }
    }
    private async readFromAllShards(request: ReadRequest): Promise<any[]> {
        const promises = ShardingConfig.SHARDS.map(async (shard) => {
            try {
                const connection = await this.dbManager.getConnection(shard.replica);
                const result = await connection.query(request.query, request.params);
                connection.release();
                return result.rows;
            } catch (error) {
                console.error(`Error reading from ${shard.name}: `,error);
                return [];
            }
        });
        const results = await Promise.all(promises);
        return results.flat();
    }

    async getShardHealth(): Promise<{[key: string]: {primary: boolean; replica: boolean}}> {
        const health: {
            [key: string]: {
                primary: boolean,
                replica: boolean
            }
        } = {}
        for(const shard of ShardingConfig.SHARDS) {
            const status = {
                primary: false,
                replica: false
            }
            try {
                const primaryConn = await this.dbManager.getConnection(shard.primary);
                await primaryConn.query('SELECT 1');
                primaryConn.release();
                status.primary = true;
            } catch (error) {
                console.error(`Primary DB for ${shard.name} is down`, error);
            }
            try {
                const replicaConn = await this.dbManager.getConnection(shard.replica);
                await replicaConn.query('SELECT 1');
                replicaConn.release();
                status.replica = true
            } catch (error) {
                console.error(`Replica DB for ${shard.name} is down`, error);
            }
            health[shard.name] = status;
        }
        return health;
    }
}
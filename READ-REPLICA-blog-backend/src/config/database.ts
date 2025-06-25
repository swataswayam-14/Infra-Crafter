import { Pool } from "pg";
import { configuration } from ".";
import logger from "../utils/logger";

class DatabaseManager {
    private masterPool: Pool;
    private replicaPools: Pool[];
    private currentReplicaIndex: number = 0;

    constructor() {
        this.masterPool = new Pool({
            host: configuration.masterDb.host,
            port:configuration.masterDb.port,
            database: configuration.masterDb.database,
            user: configuration.masterDb.username,
            password: configuration.masterDb.password,
            max: 20, // only 20 clients can be active at once
            idleTimeoutMillis: 30000, //idle clients are removed after 30s
            connectionTimeoutMillis: 2000, // wait max 2s to get a DB connection
        });
        this.replicaPools = configuration.replicaDbs.map(replicaConfig =>
            new Pool({
                host: replicaConfig.host,
                port: replicaConfig.port,
                database: replicaConfig.database,
                user: replicaConfig.username,
                password: replicaConfig.password,
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            })
        );
        this.setupConnectionHandlers();
    }
    private setupConnectionHandlers() {
        this.masterPool.on('connect', () => {
            logger.info('Connected to master database');
        });
        this.masterPool.on('error', (err)=> {
            logger.error({err},'Master database connection error');
        });
        this.replicaPools.forEach((pool, index) => {
            pool.on('connect', () => {
                logger.info(`Connected to replica database ${index+1}`)
            });
            pool.on('error', (err) => {
                logger.error({err}, `Replica database ${index+1} connection error`)
            });
        });
    }
    //get master database for write operations
    getMasterDB(): Pool {
        return this.masterPool;
    }
    //get replica database for read operations (round-robin load balancing)
    //replicaPools = [replica1, replica2, replica3]

    //Every time getReplicaDB() is called:
    //1st call → replica1
    //2nd call → replica2
    //3rd call → replica3
    //4th call → back to replica1 (because of % operator)

    getReplicaDB():Pool {
        if(this.replicaPools.length == 0) {
            logger.warn('No replica databases available, faliing back to master');
            return this.masterPool;
        }
        const selectedPool = this.replicaPools[this.currentReplicaIndex];
        this.currentReplicaIndex = (this.currentReplicaIndex + 1) % this.replicaPools.length;
        return selectedPool;
    }

    //get random replica for better load distribution
    getRandomReplicaDB():Pool {
        if(this.replicaPools.length == 0) return this.masterPool;
        const randomIndex = Math.floor(Math.random() * this.replicaPools.length)
        return this.replicaPools[randomIndex];
    }

    async healthCheck(): Promise<{master:boolean; replicas:boolean[]}> {
        const masterHealth = await this.checkConnection(this.masterPool);
        const replicaHealths = await Promise.all (this.replicaPools.map(pool => this.checkConnection(pool)));

        return {
            master: masterHealth,
            replicas: replicaHealths,
        }
    }

    private async checkConnection(pool: Pool) : Promise<boolean> {
        try {
            const client = await pool.connect();
            client.query('SELECT 1');
            client.release();
            return true;
        } catch (error) {
            logger.error({error}, 'Database health check failed');
            return false;
        }
    }
    getReplicaPool(): Pool[] {
        return this.replicaPools;
    }
    
    async closeAll(): Promise<void> {
        await this.masterPool.end();
        await Promise.all(this.replicaPools.map(pool => pool.end()));
        logger.info('All database connections closed');
    }
}

export const dbManager = new DatabaseManager();
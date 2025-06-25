import { Pool } from "pg";
import { configuration } from "../config";
import { dbManager } from "../config/database";
import logger from "../utils/logger";

export class ReplicationService {
    private readonly syncTimeout = configuration.replication.syncTimeout;
    private readonly maxRetries = configuration.replication.maxRetries;

    async executeWithReplication(
        query: string,
        params: any[] = [],
        operation: 'read' | 'write' = 'read'
    ): Promise<any> {
        if(operation == 'read') return this.executeReadQuery(query, params);
        else return this.executeWriteQuery(query,params);
    }
    private async executeReadQuery(query: string, params: any[]): Promise<any> {
        const replicaDB = dbManager.getReplicaDB();
        try {
            const result = await replicaDB.query(query, params);
            logger.debug(`Read query executed on replica : ${query}`);
            return result;
        } catch (error) {
            logger.warn({error},'Replica query failed falling back to Master');
            const masterDB = dbManager.getMasterDB();
            const result = await masterDB.query(query, params);
            logger.debug(`Read query executed on master (fallback): ${query}`);
            return result;
        }
    }
    private async executeWriteQuery(query:string, params: any[]): Promise<any>{
        const masterDB = dbManager.getMasterDB();
        if (configuration.replication.strategy === 'sync') return this.executeSyncReplication(query, params, masterDB)
        else return this.executeAsyncReplication(query, params, masterDB);
    }

    //synchrounous replication implementation
    private async executeSyncReplication(query: string, params: any[], masterDB: Pool): Promise<any> {
        const client = await masterDB.connect();
        try {
            await client.query('BEGIN');
            const result = await client.query(query, params);
            logger.debug(`Write query executed on master: ${query}`);

            //wait for replication to all replicas
            const replicaPool:Pool[] = dbManager.getReplicaPool();
             
            const replicationPromises = replicaPool.map(replicaDB => this.waitForReplication(query, params, replicaDB))

            //wait for all replicas with timeout
            //this is to ensure a strict timeout on replication, without it, a slow or hanging replica could block the master transaction indefinitely.
            await Promise.race([
                Promise.all(replicationPromises),
                new Promise((_, reject) => setTimeout(() => reject(new Error(' Sync Replication timeout')), this.syncTimeout))
            ]); // all replica must replicate within syncTimeout = 5 seconds
            await client.query('COMMIT');
            logger.info('Synchronous replication completed successfully');
            return result; // the result is returned after all the replicas have been updated , this leads to strong consistency but more delay
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error({error}, 'Synchronous replication failed');
            throw error;
        } finally {
            client.release();
        }
    }
    private async waitForReplication(query:string, params: any[], replicaDB: Pool) {
        let attempts = 0;
        const maxAttempts = 10;

        while(attempts < maxAttempts) {
            let i = 1;
            try {
                await replicaDB.query(query, params);
                logger.debug(`Replica ${i++} replicated query: ${query}`);
            } catch (error:any) {
                attempts++;
                logger.warn(`Attempt ${attempts} failed for Replica: ${i++} replication: ${error.message}`);
                await new Promise(res => setTimeout(res, 100)); // 100ms delay before retry
            }
        }
        throw new Error('max replication attempts exceeded for a replica');
    }
    private async executeAsyncReplication(
        query: string, 
        params: any[],
        masterDB:Pool
    ): Promise<any> {
        const result = await masterDB.query(query, params);
        logger.debug(`Write query executed on master: ${query}`);
        const replicaPool = dbManager.getReplicaPool();
        let i = 0;
        Promise.all(
            replicaPool.map(async(replicaDB) => {
                i++;
                try {
                    await replicaDB.query(query, params)
                } catch (error) {
                    logger.error({error}, `Async replication to replica ${i} failed`);
                    this.retryReplication(query, params,replicaDB, i);
                }
            })
        ).catch(error => logger.error({error}, 'some async replication failed'));
        return result;
    }
    private async retryReplication(
        query: string,
        params:any[],
        replicaDB:Pool,
        replicationIndex:number,
        attempt:number = 1
    ): Promise<void> {
        if (attempt> this.maxRetries) {
            logger.error(`Max retries execeeded for replica ${replicationIndex}`)
            return;
        }
        try {
            //exponential backoff
            const delay = Math.pow(2,attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            await replicaDB.query(query, params);
            logger.info(`Retry ${attempt} successful for replica ${replicationIndex}`);
        } catch (error) {
            logger.warn({error}, `Retry ${attempt} failed for replica ${replicationIndex}`);
        }
    }
}
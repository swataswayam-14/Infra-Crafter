import { replicationService } from "./replication.service";
import logger from "../utils/logger";

export class DatabaseService {
    async query(
        sql: string,
        params: any[] = [],
        operation: 'read' | 'write' = 'read'
    ): Promise<any> {
        try {
            const startTime = Date.now();
            const result = await replicationService.executeWithReplication(sql, params, operation);
            const duration = Date.now() - startTime;
            logger.debug(`Query executed in ${duration} ms`, {
                operation,
                sql: sql.substring(0,100),
                duration,
                rowCount: result.rowCount
            });
            return result
        } catch (error:any) {
            logger.error({
                sql: sql.substring(0,100),
                params,
                operation,
                error: error.message
            });
            throw error;
        }
    }
    async transaction(operations: Array<{sql:string;params:any[]}>):Promise<any[]>{
        //for transactions, we must use the master database
        const results = [];
        for(const operation of operations) {
            const result = await this.query(operation.sql, operation.params, 'write');
            results.push(result);
        }
        return results;
    }
}

export const databaseService = new DatabaseService();
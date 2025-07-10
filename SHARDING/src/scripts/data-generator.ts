import { DatabaseManager } from "../config/database";
import { ShardingConfig } from "../config/sharding";

interface UserRecord {
    user_id: string;
    name: string;
    email: string;
    partition_key: string;
}

interface OrderRecord {
    user_id: string;
    order_id: string;
    amount: number;
}

export class DataGenerator {
    private dbManager: DatabaseManager;

    constructor() {
        this.dbManager = new DatabaseManager;
    }

    async generateData(): Promise<void> {
        console.log('Starting data generation...');
        for(const partition of ShardingConfig.PARTITIONS) {
            await this.generatePartitionData(partition.name, partition.size)
        }
        console.log('Data generation completed');
    }
    private async generatePartitionData(partitionName: string, sizeInMB: number): Promise<void> {
        const recordsPerMB = 1000;
        const totalRecords = sizeInMB * recordsPerMB;

        console.log(`Generating ${totalRecords} records for partition ${partitionName}...`);
        
        const shard = ShardingConfig.getShardByPartition(partitionName);
        if(!shard) throw new Error(`Shard not found for partition ${partitionName}`)

        const connection = await this.dbManager.getConnection(shard.primary);

        try {
            const userRecords = this.generateUserRecords(totalRecords / 2, partitionName);
            await this.bulkInsert(connection, 'users', userRecords);

            const orderRecords = this.generateOrderRecords(totalRecords/2, userRecords);
            await this.bulkInsert(connection, 'orders', orderRecords);
            console.log(`Partition ${partitionName} completed`);
        } catch (error) {
            console.log('Error in generating user record and order record', error);
        } finally {
            connection.release();
        }
    }
    private generateUserRecords(count: number, partitionKey: string): UserRecord[] {
        const records: UserRecord[] = [];
        for(let i=0;i<count;i++) {
            records.push({
                user_id: `user_${partitionKey}_${i}`,
                name: `User ${i}`,
                email: `user${i}@example.com`,
                partition_key: partitionKey
            });
        }
        return records;
    }
    private generateOrderRecords(count: number, userRecords: UserRecord[]): OrderRecord[] {
        const records: OrderRecord[] = [];
        for(let i=0;i<count;i++) {
            const randomUser = userRecords[Math.floor(Math.random() * userRecords.length)];

            records.push({
                user_id: randomUser.user_id,
                order_id: `order_${i}`,
                amount: Math.random() * 1000
            })
        }
        return records;
    }
    private async bulkInsert(connection: any, table: string, records: any){
        const batchSize = 1000;
        for(let i=0;i<records.length;i+= batchSize) {
            const batch = records.slice(i,i+batchSize);

            if(batch.length === 0) continue;

            const columns = Object.keys(batch[0]).join(', ');
            const values = batch.map((record:any, index:any) => {
                const recordValues = Object.values(record);
                const placeholders = recordValues.map((_, valueIndex) =>
                    `$${index * recordValues.length + valueIndex + 1}`
                ).join(', ');
                return `(${placeholders})`
            }).join(', ');

            const query = `INSERT INTO ${table} (${columns}) VALUES ${values}`;
            //@ts-ignore
            const allValues = batch.flatMap(record => Object.values(record));

            await connection.query(query, allValues);
        }
    }
    async cleanup(): Promise<void> {
        await this.dbManager.closeAll();
    }
}

if(require.main === module) {
    const generator = new DataGenerator();
    generator.generateData().then(() => generator.cleanup()).catch(console.error);
}
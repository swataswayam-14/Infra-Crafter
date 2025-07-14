import { ShardConfig } from "./config/Sharding";
import {createHash} from 'crypto';
import { Client } from "pg";
import {exec} from 'child_process';
import { promisify } from "util";

let currentPort = 5441; 
const execAsync = promisify(exec);

export class ConsistentHashing {
    static SHARDS: ShardConfig[] = [
        {
            name: 'shard1',
            partitions: ['ring1'],
            primary: 'shard1-primary',
            replica: 'shard1-replica',
            weight: 20
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
        },
         {
            name: 'shard4',
            partitions: ['ring4'],
            primary: 'shard4-primary',
            replica: 'shard4-replica',
            weight: 30
        },
    ];

    static readonly TABLE_SCHEMA = `
        CREATE TABLE IF NOT EXISTS users (
            user_id SERIAL PRIMARY KEY,
            username VARCHAR NOT NULL
        );
    `;

    private static readonly VIRTUAL_NODES = 150;
    private static ring: Map<number, ShardConfig> = new Map();
    private static sortedHashes: number[] = [];
    private static initialised = false;
    private static containerPorts: Map<string, number> = new Map();

    private static hashKey(key: string): number {
        const hash = createHash('sha256').update(key).digest('hex').slice(0, 8);
        return parseInt(hash, 16);
    }

    private static initializeRing(): void {
        if(this.initialised) return;
        this.ring.clear();

        for(const shard of this.SHARDS) {
            const virtualNodeCount = Math.floor(this.VIRTUAL_NODES * (shard.weight / 100));
            for (let i = 0; i < virtualNodeCount; i++) {
                const virtualNodeKey = `${shard.name}-${i}`;
                const hash = this.hashKey(virtualNodeKey);
                this.ring.set(hash, shard);
            }
        }
        
        this.sortedHashes = Array.from(this.ring.keys()).sort((a, b) => a - b);
        this.initialised = true;
    }

    static getShardByKey(key: string): ShardConfig {
        this.initializeRing();

        const hash = this.hashKey(key);
        
        for (const ringHash of this.sortedHashes) {
            if (ringHash >= hash) return this.ring.get(ringHash)!;
        }
        
        return this.ring.get(this.sortedHashes[0])!;
    }

    private static async waitForPostgresReady(port: number): Promise<void> {
        const client = new Client({
            user: 'postgres',
            password: 'password',
            host: 'localhost',
            port,
            database: 'postgres',
        });

        let retries = 10; 
        while (retries) {
            try {
                await client.connect();
                await client.query('SELECT 1');
                await client.end();
                console.log(`Postgres ready on port ${port}`);
                return;
            } catch (error) {
                retries--;
                console.log(`Waiting for Postgres on port ${port}... Retries left: ${retries}`);
                if (retries === 0) {
                    console.error(`Final connection attempt failed:`, error);
                }
                await new Promise(res => setTimeout(res, 3000)); 
            }
        }
        throw new Error(`Postgres not ready on port ${port} after 30 retries`);
    }

    private static async spinUpPostgresContainer(containerName: string, port: number): Promise<void> {
        try {
            const checkCmd = `docker ps -a --filter "name=${containerName}" --format "{{.Names}}"`;
            const { stdout } = await execAsync(checkCmd);
            
            if (stdout.trim() === containerName) {
                console.log(`📦 Container ${containerName} already exists, removing...`);
                await execAsync(`docker rm -f ${containerName}`);
            }
            try {
                const portCheck = await execAsync(`netstat -an | grep :${port}`);
                if (portCheck.stdout.trim()) {
                    throw new Error(`Port ${port} is already in use`);
                }
            } catch (error) {
            }

            const cmd = `
                docker run -d \
                --name ${containerName} \
                -e POSTGRES_USER=postgres \
                -e POSTGRES_PASSWORD=password \
                -e POSTGRES_DB=postgres \
                -p ${port}:5432 \
                postgres:15
            `;
            
            console.log(`Starting container ${containerName} on port ${port}...`);
            await execAsync(cmd);
            this.containerPorts.set(containerName, port);
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.error(`Failed to start container ${containerName}:`, error);
            throw error;
        }
    }

    static async addShard(shardName: string, weight = 25): Promise<void> {
        if (weight <= 0 || weight > 100) {
            throw new Error(`Invalid weight: ${weight}. Weight must be between 1 and 100.`);
        }
        const existingShard = this.SHARDS.find(s => s.name === shardName);
        if (existingShard) {
            throw new Error(`Shard ${shardName} already exists`);
        }
        const currentTotalWeight = this.SHARDS.reduce((sum, shard) => sum + shard.weight, 0);
        
        if (currentTotalWeight + weight > 100) {
            const availableWeight = 100 - weight;
            const scalingFactor = availableWeight / currentTotalWeight;
            
            console.log(`Adjusting existing shard weights to accommodate new shard weight of ${weight}%`);
            console.log(`Current total weight: ${currentTotalWeight}%, Available for existing: ${availableWeight}%`);
            
            for (const shard of this.SHARDS) {
                const oldWeight = shard.weight;
                shard.weight = Math.max(1, Math.round(shard.weight * scalingFactor));
                console.log(`   ${shard.name}: ${oldWeight}% → ${shard.weight}%`);
            }
        }

        const masterPort = currentPort++;
        const replicaPort = currentPort++;

        const masterContainer = `${shardName}_master`;
        const replicaContainer = `${shardName}_replica`;

        let masterClient: Client | null = null;
        let replicaClient: Client | null = null;

        try {
            console.log(`Spinning up containers for ${shardName}...`);
            await this.spinUpPostgresContainer(masterContainer, masterPort);
            await this.spinUpPostgresContainer(replicaContainer, replicaPort);

            await this.waitForPostgresReady(masterPort);
            await this.waitForPostgresReady(replicaPort);

            masterClient = new Client({
                user: 'postgres',
                password: 'password',
                host: 'localhost',
                port: masterPort,
                database: 'postgres',
            });

            replicaClient = new Client({
                user: 'postgres',
                password: 'password',
                host: 'localhost',
                port: replicaPort,
                database: 'postgres',
            });

            await masterClient.connect();
            await replicaClient.connect();

            await masterClient.query(this.TABLE_SCHEMA);
            await replicaClient.query(this.TABLE_SCHEMA);

            this.SHARDS.push({
                name: shardName,
                partitions: [`${shardName}-ring`],
                primary: `${shardName}-primary`,
                replica: `${shardName}-replica`,
                weight
            });


            this.initialised = false;
            console.log(`Shard ${shardName} added with weight ${weight}%`);
            console.log(`Final weight distribution:`);
            this.SHARDS.forEach(shard => {
                console.log(`   ${shard.name}: ${shard.weight}%`);
            });
        } catch (error) {
            console.error(`Failed to add shard ${shardName}:`, error);
            try {
                await execAsync(`docker rm -f ${masterContainer} ${replicaContainer}`);
            } catch (cleanupError) {
                console.error(`Failed to cleanup containers:`, cleanupError);
            }
            
            throw error;
        } finally {
            if (masterClient) {
                try {
                    await masterClient.end();
                } catch (error) {
                    console.error(`Failed to close master client:`, error);
                }
            }
            if (replicaClient) {
                try {
                    await replicaClient.end();
                } catch (error) {
                    console.error(`Failed to close replica client:`, error);
                }
            }
        }
    }

    static async removeShard(shardName: string): Promise<void> {
        const index = this.SHARDS.findIndex(s => s.name === shardName);
        if (index === -1) {
            throw new Error(`Shard ${shardName} not found`);
        }

        const removedWeight = this.SHARDS[index].weight;

        try {
            const masterContainer = `${shardName}_master`;
            const replicaContainer = `${shardName}_replica`;
            
            console.log(`Removing containers for ${shardName}...`);
            await execAsync(`docker rm -f ${masterContainer} ${replicaContainer}`);
            
            this.containerPorts.delete(masterContainer);
            this.containerPorts.delete(replicaContainer);
            
            this.SHARDS.splice(index, 1);
            
            if (this.SHARDS.length > 0) {
                console.log(`Redistributing ${removedWeight}% weight among remaining shards`);
                
                const currentTotalWeight = this.SHARDS.reduce((sum, shard) => sum + shard.weight, 0);
                const scalingFactor = 100 / currentTotalWeight;
                
                for (const shard of this.SHARDS) {
                    const oldWeight = shard.weight;
                    shard.weight = Math.round(shard.weight * scalingFactor);
                    console.log(`   ${shard.name}: ${oldWeight}% → ${shard.weight}%`);
                }
            }
            this.initialised = false; 
            
            console.log(`Shard ${shardName} removed successfully`);
            console.log(`Final weight distribution:`);
            this.SHARDS.forEach(shard => {
                console.log(`   ${shard.name}: ${shard.weight}%`);
            });
        } catch (error) {
            console.error(`Failed to remove shard ${shardName}:`, error);
            throw error;
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

    static getShardStats(): { name: string; weight: number; virtualNodes: number; }[] {
        this.initializeRing();
        return this.SHARDS.map(shard => ({
            name: shard.name,
            weight: shard.weight,
            virtualNodes: Math.floor(this.VIRTUAL_NODES * (shard.weight / 100))
        }));
    }

    static getContainerPorts(): Map<string, number> {
        return new Map(this.containerPorts);
    }

    static async cleanup(): Promise<void> {
        console.log('Cleaning up all containers...');
        const containerNames = Array.from(this.containerPorts.keys());
        
        for (const containerName of containerNames) {
            try {
                await execAsync(`docker rm -f ${containerName}`);
                console.log(`Removed container ${containerName}`);
            } catch (error) {
                console.error(`Failed to remove container ${containerName}:`, error);
            }
        }
        
        this.containerPorts.clear();
        console.log('Cleanup completed');
    }

    static validateWeights(): boolean {
        const totalWeight = this.SHARDS.reduce((sum, shard) => sum + shard.weight, 0);
        return totalWeight === 100;
    }

    static rebalanceWeights(): void {
        if (this.SHARDS.length === 0) return;
        
        console.log(`Rebalancing weights equally among ${this.SHARDS.length} shards`);
        
        const equalWeight = Math.floor(100 / this.SHARDS.length);
        const remainder = 100 % this.SHARDS.length;
        
        for (let i = 0; i < this.SHARDS.length; i++) {
            const oldWeight = this.SHARDS[i].weight;
            this.SHARDS[i].weight = equalWeight + (i < remainder ? 1 : 0);
            console.log(`   ${this.SHARDS[i].name}: ${oldWeight}% → ${this.SHARDS[i].weight}%`);
        }
        
        this.initialised = false; 
        console.log(`Weights rebalanced successfully`);
    }
}
import { DatabaseManager } from '../config/database';
import { ShardingConfig } from '../config/sharding';

export class DatabaseSetup {
  private dbManager: DatabaseManager;

  constructor() {
    this.dbManager = new DatabaseManager();
  }

  async setupAll(): Promise<void> {
    console.log('Setting up databases...');
    
    for (const shard of ShardingConfig.SHARDS) {
      await this.setupShard(shard.name, shard.primary);
    }
    
    console.log('Database setup completed');
  }

  private async setupShard(shardName: string, primaryKey: string): Promise<void> {
    console.log(`🔨 Setting up ${shardName}...`);
    
    const connection = await this.dbManager.getConnection(primaryKey);
    
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(50) NOT NULL,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          partition_key VARCHAR(10) NOT NULL
        )
      `);
      
      await connection.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(50) NOT NULL,
          order_id VARCHAR(50) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await connection.query(`
        CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id)
      `);
      
      await connection.query(`
        CREATE INDEX IF NOT EXISTS idx_users_partition_key ON users(partition_key)
      `);
      
      await connection.query(`
        CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)
      `);
      
      await connection.query(`
        CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id)
      `);
      
      console.log(`${shardName} setup completed`);
    } finally {
      connection.release();
    }
  }

  async cleanup(): Promise<void> {
    await this.dbManager.closeAll();
  }
}

if (require.main === module) {
  const setup = new DatabaseSetup();
  setup.setupAll()
    .then(() => setup.cleanup())
    .catch(console.error);
}
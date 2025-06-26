import dotenv from 'dotenv';

dotenv.config();

export const configuration = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // master database (Read/Write)
  masterDb: {
    host: process.env.MASTER_DB_HOST || 'localhost',
    port: parseInt(process.env.MASTER_DB_PORT || '5432'),
    database: process.env.MASTER_DB_NAME || 'blog_master',
    username: process.env.MASTER_DB_USER || 'postgres',
    password: process.env.MASTER_DB_PASSWORD || 'password',
  },
  
  // read replica databases (Read Only)
  replicaDbs: [
    {
      host: process.env.REPLICA1_DB_HOST || 'localhost',
      port: parseInt(process.env.REPLICA1_DB_PORT || '5433'),
      database: process.env.REPLICA1_DB_NAME || 'blog_replica1',
      username: process.env.REPLICA1_DB_USER || 'postgres',
      password: process.env.REPLICA1_DB_PASSWORD || 'password',
    },
    {
      host: process.env.REPLICA2_DB_HOST || 'localhost',
      port: parseInt(process.env.REPLICA2_DB_PORT || '5434'),
      database: process.env.REPLICA2_DB_NAME || 'blog_replica2',
      username: process.env.REPLICA2_DB_USER || 'postgres',
      password: process.env.REPLICA2_DB_PASSWORD || 'password',
    }
  ],
  
  replication: {
    strategy: process.env.REPLICATION_STRATEGY || 'sync', // 'sync' or 'async'
    syncTimeout: parseInt(process.env.SYNC_TIMEOUT || '5000'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
};
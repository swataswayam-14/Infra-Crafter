import { Client } from 'pg';
import fs from 'fs';
import ora from 'ora';
import chalk from 'chalk';

const sqlFilePath = './init.sql';
const sql = fs.readFileSync(sqlFilePath, 'utf-8');

// Database configurations
const databases = [
  {
    name: 'Master DB',
    host: process.env.MASTER_DB_HOST || 'localhost',
    port: parseInt(process.env.MASTER_DB_PORT || '5432'),
    database: process.env.MASTER_DB_NAME || 'blog_master',
    user: process.env.MASTER_DB_USER || 'postgres',
    password: process.env.MASTER_DB_PASSWORD || 'password',
  },
  {
    name: 'Replica 1',
    host: process.env.REPLICA1_DB_HOST || 'localhost',
    port: parseInt(process.env.REPLICA1_DB_PORT || '5433'),
    database: process.env.REPLICA1_DB_NAME || 'blog_replica1',
    user: process.env.REPLICA1_DB_USER || 'postgres',
    password: process.env.REPLICA1_DB_PASSWORD || 'password',
  },
  {
    name: 'Replica 2',
    host: process.env.REPLICA2_DB_HOST || 'localhost',
    port: parseInt(process.env.REPLICA2_DB_PORT || '5434'),
    database: process.env.REPLICA2_DB_NAME || 'blog_replica2',
    user: process.env.REPLICA2_DB_USER || 'postgres',
    password: process.env.REPLICA2_DB_PASSWORD || 'password',
  }
];

async function initDatabase(dbConfig: any) {
  const client = new Client(dbConfig);
  const spinner = ora(`Initializing ${dbConfig.name}...`).start();

  try {
    await client.connect();
    await client.query(sql);
    spinner.succeed(`${dbConfig.name} initialized successfully ✅`);
  } catch (err: any) {
    spinner.fail(`${dbConfig.name} failed ❌`);
    console.error(chalk.red(err.message));
  } finally {
    await client.end();
  }
}

async function run() {
  for (const db of databases) {
    await initDatabase(db);
  }
  console.log(chalk.green('\n🎉 All databases initialized.\n'));
}

run();

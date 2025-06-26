import { databaseService } from './services/database.service';
import logger from './utils/logger';

async function initializeDatabase() {
  try {
    await databaseService.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `, [], 'write');

    await databaseService.query(`
      CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `, [], 'write');

    await databaseService.query(`
      INSERT INTO users (name, email)
      VALUES 
        ('Alice', 'alice@example.com'),
        ('Bob', 'bob@example.com'),
        ('Charlie', 'charlie@example.com');
    `, [], 'write');

    await databaseService.query(`
      INSERT INTO test_table (message)
      VALUES 
        ('Hello from test_table!'),
        ('Another message here.');
    `, [], 'write');

    logger.info('Database initialized with sample data.');
  } catch (error) {
    logger.error({error},'Error initializing database:');
  }
}

initializeDatabase();

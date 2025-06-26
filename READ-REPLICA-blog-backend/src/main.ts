import { databaseService } from './services/database.service';
import logger from './utils/logger';

async function main() {
  try {
    const readResult = await databaseService.query(
      'SELECT * FROM users LIMIT 5;',
      [],
      'read'
    );
    logger.info({ readResult: readResult.rows }, 'Read query executed successfully');

    const writeResult = await databaseService.query(
      'INSERT INTO test_table (message, created_at) VALUES ($1, NOW()) RETURNING *;',
      ['Test message from main.ts'],
      'write'
    );
    logger.info({ writeResult: writeResult.rows[0] }, 'Write query executed successfully');


    const transactionResult = await databaseService.transaction([
      {
        sql: 'INSERT INTO test_table (message, created_at) VALUES ($1, NOW()) RETURNING *;',
        params: ['Transaction message 1']
      },
      {
        sql: 'INSERT INTO test_table (message, created_at) VALUES ($1, NOW()) RETURNING *;',
        params: ['Transaction message 2']
      }
    ]);

    logger.info({
      transactionResults: transactionResult.map(res => res.rows[0])
    }, 'Transaction completed successfully');

  } catch (error) {
    logger.error({error},'Error occurred: ');
  }
}

main();

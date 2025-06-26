import { databaseService } from './services/database.service';
import { dbManager } from './config/database';
import logger from './utils/logger';

async function main() {
  try {
    const {master, replicas} = await dbManager.healthCheck();

    if(master === true) logger.info("Master Database is healthy");
    else logger.warn("Master database is not healthy");
    if(replicas[0] === true) logger.info("Replica 1 is healthy");
    else logger.warn("Replica 1 is not healthy");
    if(replicas[1] === true) logger.info("Replica 2 is healthy");
    else logger.warn("Replica 2 is not healthy");
    
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

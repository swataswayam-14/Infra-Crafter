import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { performance } from 'perf_hooks';
import {isMainThread} from 'worker_threads';

import { databaseService } from './services/database.service';
import { dbManager } from './config/database';
import { replicationService } from './services/replication.service';
import { configuration } from './config';

interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  details: any;
  error?: string;
}

class ReplicaTestCLI {
  private results: TestResult[] = [];
  private testData: any[] = [];

  constructor() {
    this.setupTestData();
  }

  private setupTestData() {
    for (let i = 0; i < 1000; i++) {
      this.testData.push({
        id: i + 1,
        title: `Test Post ${i + 1}`,
        content: `This is test content for post ${i + 1}. `.repeat(10),
        author: `author${i % 10}`,
        created_at: new Date(Date.now() - Math.random() * 86400000 * 30) // Random date within last 30 days
      });
    }
  }

  private log(level: 'info' | 'warn' | 'error' | 'success', message: string) {
    const timestamp = new Date().toISOString();
    const colors = {
      info: chalk.blue,
      warn: chalk.yellow,
      error: chalk.red,
      success: chalk.green
    };
    console.log(`${chalk.gray(timestamp)} ${colors[level](`[${level.toUpperCase()}]`)} ${message}`);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testDatabaseHealth(): Promise<TestResult> {
    const spinner = ora('Testing database connections health').start();
    const startTime = performance.now();

    try {
      const healthCheck = await dbManager.healthCheck();
      const duration = performance.now() - startTime;

      spinner.succeed('Database health check completed');
      
      this.log('info', `Master DB: ${healthCheck.master ? 'Healthy' : 'Unhealthy'}`);
      healthCheck.replicas.forEach((replica, index) => {
        this.log('info', `Replica ${index + 1}: ${replica ? 'Healthy' : 'Unhealthy'}`);
      });

      return {
        testName: 'Database Health Check',
        success: healthCheck.master && healthCheck.replicas.every(r => r),
        duration,
        details: healthCheck
      };
    } catch (error: any) {
      spinner.fail('Database health check failed');
      return {
        testName: 'Database Health Check',
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error.message
      };
    }
  }

  //Read Operations (Round Robin Testing)
  async testReadOperations(): Promise<TestResult> {
    const spinner = ora('Testing read operations and round-robin load balancing').start();
    const startTime = performance.now();

    try {
      await this.seedTestData();

      const readPromises = [];
      const readCount = 20;

      for (let i = 0; i < readCount; i++) {
        readPromises.push(
          databaseService.query(
            'SELECT id, title, author FROM posts LIMIT 5',
            [],
            'read'
          )
        );
      }

      const results = await Promise.all(readPromises);
      const duration = performance.now() - startTime;

      spinner.succeed('Read operations test completed');

      return {
        testName: 'Read Operations & Load Balancing',
        success: true,
        duration,
        details: {
          totalQueries: readCount,
          successfulQueries: results.length,
          averageResponseTime: duration / readCount,
          sampleRowCount: results[0]?.rowCount || 0
        }
      };
    } catch (error: any) {
      spinner.fail('Read operations test failed');
      return {
        testName: 'Read Operations & Load Balancing',
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error.message
      };
    }
  }

  async testWriteOperations(): Promise<TestResult> {
    const spinner = ora('Testing write operations on master database').start();
    const startTime = performance.now();

    try {
      const writePromises = [];
      const writeCount = 10;

      for (let i = 0; i < writeCount; i++) {
        const testPost = this.testData[i];
        writePromises.push(
          databaseService.query(
            'INSERT INTO posts (title, content, author) VALUES ($1, $2, $3) RETURNING id',
            [testPost.title, testPost.content, testPost.author],
            'write'
          )
        );
      }

      const results = await Promise.all(writePromises);
      const duration = performance.now() - startTime;

      spinner.succeed('Write operations test completed');

      return {
        testName: 'Write Operations',
        success: true,
        duration,
        details: {
          totalWrites: writeCount,
          successfulWrites: results.length,
          averageWriteTime: duration / writeCount,
          insertedIds: results.map(r => r.rows[0]?.id).filter(Boolean)
        }
      };
    } catch (error: any) {
      spinner.fail('Write operations test failed');
      return {
        testName: 'Write Operations',
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error.message
      };
    }
  }

  async testReplicationStrategy(): Promise<TestResult> {
    const spinner = ora(`Testing ${configuration.replication.strategy} replication strategy`).start();
    const startTime = performance.now();

    try {
      const testQueries = [
        {
          sql: 'INSERT INTO posts (title, content, author) VALUES ($1, $2, $3)',
          params: ['Replication Test Post', 'Testing replication strategy', 'test-user']
        },
        {
          sql: 'UPDATE posts SET title = $1 WHERE author = $2',
          params: ['Updated Replication Test', 'test-user']
        }
      ];

      const results = [];
      for (const query of testQueries) {
        const result = await replicationService.executeWithReplication(
          query.sql,
          query.params,
          'write'
        );
        results.push(result);
        
        await this.sleep(100);
      }

      const duration = performance.now() - startTime;
      spinner.succeed('Replication strategy test completed');

      return {
        testName: `${configuration.replication.strategy.toUpperCase()} Replication`,
        success: true,
        duration,
        details: {
          strategy: configuration.replication.strategy,
          syncTimeout: configuration.replication.syncTimeout,
          maxRetries: configuration.replication.maxRetries,
          operationsExecuted: results.length
        }
      };
    } catch (error: any) {
      spinner.fail('Replication strategy test failed');
      return {
        testName: `${configuration.replication.strategy.toUpperCase()} Replication`,
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error.message
      };
    }
  }

  // Replica Failover Simulation
  async testReplicaFailover(): Promise<TestResult> {
    const spinner = ora('Testing replica failover to master').start();
    const startTime = performance.now();

    try {
      const failoverQueries = [];
      
      for (let i = 0; i < 15; i++) {
        failoverQueries.push(
          databaseService.query(
            'SELECT COUNT(*) as total_posts FROM posts',
            [],
            'read'
          ).catch(async (error) => {
            this.log('warn', `Replica query failed, attempting master fallback: ${error.message}`);
            return { failedToReplica: true, error: error.message };
          })
        );
      }

      const results = await Promise.all(failoverQueries);
      const duration = performance.now() - startTime;

      const successfulQueries = results.filter(r => !r.failedToReplica).length;
      const failedQueries = results.filter(r => r.failedToReplica).length;

      spinner.succeed('Replica failover test completed');

      return {
        testName: 'Replica Failover',
        success: true,
        duration,
        details: {
          totalQueries: results.length,
          successfulQueries,
          failedToReplica: failedQueries,
          failoverWorking: successfulQueries > 0
        }
      };
    } catch (error: any) {
      spinner.fail('Replica failover test failed');
      return {
        testName: 'Replica Failover',
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error.message
      };
    }
  }

  async testTransactions(): Promise<TestResult> {
    const spinner = ora('Testing database transactions').start();
    const startTime = performance.now();

    try {
      const transactionOperations = [
        {
          sql: 'INSERT INTO posts (title, content, author) VALUES ($1, $2, $3)',
          params: ['Transaction Post 1', 'First post in transaction', 'transaction-user']
        },
        {
          sql: 'INSERT INTO posts (title, content, author) VALUES ($1, $2, $3)',
          params: ['Transaction Post 2', 'Second post in transaction', 'transaction-user']
        },
        {
          sql: 'UPDATE posts SET content = $1 WHERE author = $2',
          params: ['Updated content in transaction', 'transaction-user']
        }
      ];

      const results = await databaseService.transaction(transactionOperations);
      const duration = performance.now() - startTime;

      spinner.succeed('Transaction test completed');

      return {
        testName: 'Database Transactions',
        success: true,
        duration,
        details: {
          operationsInTransaction: transactionOperations.length,
          successfulOperations: results.length,
          allOperationsSucceeded: results.length === transactionOperations.length
        }
      };
    } catch (error: any) {
      spinner.fail('Transaction test failed');
      return {
        testName: 'Database Transactions',
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error.message
      };
    }
  }

  async testHighLoadConcurrent(): Promise<TestResult> {
    const spinner = ora('Testing high load concurrent operations').start();
    const startTime = performance.now();

    try {
      const concurrentReads = [];
      const concurrentWrites = [];
      
      const readCount = 100;
      const writeCount = 20;

      for (let i = 0; i < readCount; i++) {
        concurrentReads.push(
          databaseService.query(
            'SELECT * FROM posts ORDER BY created_at DESC LIMIT 10 OFFSET $1',
            [i * 10],
            'read'
          )
        );
      }

      for (let i = 0; i < writeCount; i++) {
        concurrentWrites.push(
          databaseService.query(
            'INSERT INTO posts (title, content, author) VALUES ($1, $2, $3)',
            [`Concurrent Post ${i}`, `Content for concurrent post ${i}`, `user${i}`],
            'write'
          )
        );
      }

      const [readResults, writeResults] = await Promise.allSettled([
        Promise.all(concurrentReads),
        Promise.all(concurrentWrites)
      ]);

      const duration = performance.now() - startTime;
      spinner.succeed('High load concurrent test completed');

      return {
        testName: 'High Load Concurrent Operations',
        success: readResults.status === 'fulfilled' && writeResults.status === 'fulfilled',
        duration,
        details: {
          concurrentReads: readCount,
          concurrentWrites: writeCount,
          readSuccess: readResults.status === 'fulfilled',
          writeSuccess: writeResults.status === 'fulfilled',
          totalOperations: readCount + writeCount,
          operationsPerSecond: (readCount + writeCount) / (duration / 1000)
        }
      };
    } catch (error: any) {
      spinner.fail('High load concurrent test failed');
      return {
        testName: 'High Load Concurrent Operations',
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error.message
      };
    }
  }

  //SYSTEM OVERLOAD TEST - This will demonstrate when sharding is needed
  async testSystemOverload(): Promise<TestResult> {
    const spinner = ora('Testing system overload scenario (This may take a while...)').start();
    const startTime = performance.now();

    this.log('warn', 'Starting SYSTEM OVERLOAD TEST...');
    this.log('warn', 'This test will push your read replica setup to its limits!');

    try {
      const massiveLoad = [];
      const extremeReadCount = 1000;
      const extremeWriteCount = 200;
      const complexQueryCount = 100;

      for (let i = 0; i < extremeReadCount; i++) {
        massiveLoad.push(
          databaseService.query(
            `SELECT p.*, 
             (SELECT COUNT(*) FROM posts p2 WHERE p2.author = p.author) as author_post_count,
             (SELECT AVG(LENGTH(content)) FROM posts p3 WHERE p3.created_at >= p.created_at) as avg_content_length
             FROM posts p 
             WHERE p.content LIKE '%${i % 10}%' 
             ORDER BY p.created_at DESC 
             LIMIT 50`,
            [],
            'read'
          )
        );
      }

      for (let i = 0; i < extremeWriteCount; i++) {
        massiveLoad.push(
          databaseService.query(
            'INSERT INTO posts (title, content, author) VALUES ($1, $2, $3)',
            [
              `Overload Test Post ${i}`,
              `This is a very long content for overload testing. `.repeat(100),
              `overload_user_${i % 20}`
            ],
            'write'
          )
        );
      }

      for (let i = 0; i < complexQueryCount; i++) {
        massiveLoad.push(
          databaseService.query(
            `WITH author_stats AS (
               SELECT author, COUNT(*) as post_count, AVG(LENGTH(content)) as avg_length
               FROM posts 
               GROUP BY author
             )
             SELECT * FROM author_stats 
             WHERE post_count > 1 
             ORDER BY avg_length DESC`,
            [],
            'read'
          )
        );
      }

      this.log('info', `Executing ${massiveLoad.length} concurrent database operations...`);
      
      const results = await Promise.allSettled(massiveLoad);
      const duration = performance.now() - startTime;

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      spinner.succeed('System overload test completed');

      // Log the critical message about sharding
      if (failed > 0 || duration > 30000) { // If operations failed or took more than 30 seconds
        this.log('error', '🚨 SYSTEM OVERLOAD DETECTED! 🚨');
        this.log('error', '');
        this.log('error', '┌─────────────────────────────────────────────────────────────┐');
        this.log('error', '│                 🔥 CRITICAL PERFORMANCE ISSUE 🔥             │');
        this.log('error', '├─────────────────────────────────────────────────────────────┤');
        this.log('error', '│  Read replicas alone cannot handle this workload!          │');
        this.log('error', '│                                                             │');
        this.log('error', '│  📊 Performance Issues Detected:                           │');
        this.log('error', `│  • Failed Operations: ${failed}/${massiveLoad.length}                              │`);
        this.log('error', `│  • Total Duration: ${Math.round(duration/1000)}s                                │`);
        this.log('error', '│  • Database connections exhausted                          │');
        this.log('error', '│  • Query response time degraded significantly              │');
        this.log('error', '│                                                             │');
        this.log('error', '│  💡 SOLUTION REQUIRED:                                     │');
        this.log('error', '│  TO SOLVE THIS WE NEED SHARDING!                          │');
        this.log('error', '│                                                             │');
        this.log('error', '│  🔧 Recommended Next Steps:                               │');
        this.log('error', '│  1. Implement horizontal sharding                          │');
        this.log('error', '│  2. Partition data across multiple database shards         │');
        this.log('error', '│  3. Add connection pooling optimization                     │');
        this.log('error', '│  4. Consider caching layer (Redis/Memcached)              │');
        this.log('error', '│  5. Implement database query optimization                  │');
        this.log('error', '└─────────────────────────────────────────────────────────────┘');
        this.log('error', '');
      }

      return {
        testName: 'SYSTEM OVERLOAD TEST',
        success: failed === 0,
        duration,
        details: {
          totalOperations: massiveLoad.length,
          successfulOperations: successful,
          failedOperations: failed,
          extremeReadCount,
          extremeWriteCount,
          complexQueryCount,
          averageOperationTime: duration / massiveLoad.length,
          systemOverloaded: failed > 0 || duration > 30000,
          needsSharding: true
        }
      };
    } catch (error: any) {
      spinner.fail('System overload test failed catastrophically');
      this.log('error', '🚨 COMPLETE SYSTEM FAILURE - SHARDING REQUIRED IMMEDIATELY! 🚨');
      
      return {
        testName: 'SYSTEM OVERLOAD TEST',
        success: false,
        duration: performance.now() - startTime,
        details: { systemCrashed: true },
        error: error.message
      };
    }
  }

  private async seedTestData(): Promise<void> {
    try {
      const result = await databaseService.query('SELECT COUNT(*) as count FROM posts', [], 'read');
      const count = parseInt(result.rows[0].count);
      
      if (count < 100) {
        this.log('info', 'Seeding test data...');
        
        const batchSize = 20;
        for (let i = 0; i < Math.min(100, this.testData.length); i += batchSize) {
          const batch = this.testData.slice(i, i + batchSize);
          const promises = batch.map(post => 
            databaseService.query(
              'INSERT INTO posts (title, content, author) VALUES ($1, $2, $3)',
              [post.title, post.content, post.author],
              'write'
            )
          );
          await Promise.all(promises);
        }
        
        this.log('success', 'Test data seeded successfully');
      }
    } catch (error) {
      this.log('warn', 'Could not seed test data, proceeding with existing data');
    }
  }

  async runAllTests(): Promise<void> {
    console.log(chalk.bold.blue('\n🚀 READ REPLICA COMPREHENSIVE TEST SUITE 🚀\n'));
    console.log(chalk.yellow('Testing your database read replica implementation...\n'));

    const tests = [
      this.testDatabaseHealth(),
      this.testReadOperations(),
      this.testWriteOperations(),
      this.testReplicationStrategy(),
      this.testReplicaFailover(),
      this.testTransactions(),
      this.testHighLoadConcurrent(),
      this.testSystemOverload() 
    ];

    for (const test of tests) {
      const result = await test;
      this.results.push(result);
      
      if (result.success) {
        this.log('success', `✅ ${result.testName} - ${Math.round(result.duration)}ms`);
      } else {
        this.log('error', `❌ ${result.testName} - ${result.error || 'Unknown error'}`);
      }
      
      console.log('');
    }

    this.generateReport();
  }

  private generateReport(): void {
    console.log(chalk.bold.blue('\n📊 COMPREHENSIVE TEST REPORT 📊\n'));
    
    const successfulTests = this.results.filter(r => r.success).length;
    const totalTests = this.results.length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold(`📈 OVERALL RESULTS: ${successfulTests}/${totalTests} tests passed`));
    console.log(chalk.bold(`⏱️  TOTAL DURATION: ${Math.round(totalDuration)}ms`));
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

    this.results.forEach(result => {
      const status = result.success ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
      const duration = chalk.yellow(`${Math.round(result.duration)}ms`);
      
      console.log(`\n${status} ${chalk.bold(result.testName)} (${duration})`);
      
      if (Object.keys(result.details).length > 0) {
        Object.entries(result.details).forEach(([key, value]) => {
          console.log(`   ${chalk.gray('└─')} ${key}: ${chalk.white(JSON.stringify(value))}`);
        });
      }
      
      if (result.error) {
        console.log(`   ${chalk.red('└─ Error:')} ${result.error}`);
      }
    });

    console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold('⚙️  CONFIGURATION SUMMARY'));
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(`Replication Strategy: ${chalk.yellow(configuration.replication.strategy)}`);
    console.log(`Sync Timeout: ${chalk.yellow(configuration.replication.syncTimeout + 'ms')}`);
    console.log(`Max Retries: ${chalk.yellow(configuration.replication.maxRetries)}`);
    console.log(`Replica Count: ${chalk.yellow(configuration.replicaDbs.length)}`);

    console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold.green('🎉 READ replica testing completed! 🎉'));
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  }
}

const program = new Command();

program
  .name('replica-test')
  .description('Comprehensive testing tool for read replica database implementation')
  .version('1.0.0');

program
  .command('run')
  .description('Run all read replica tests')
  .action(async () => {
    const cli = new ReplicaTestCLI(); 
    await cli.runAllTests();
  });
program
  .command('replication')
  .description('Run all Replication Strategy tests')
  .action(async () => {
    const cli = new ReplicaTestCLI(); 
    await cli.testReplicationStrategy();
  });
program
  .command('write')
  .description('Run all Write Operations tests')
  .action(async () => {
    const cli = new ReplicaTestCLI();
    await cli.runAllTests();
  });
program
  .command('read')
  .description('Run all Read Operations tests')
  .action(async () => {
    const cli = new ReplicaTestCLI();
    await cli.runAllTests();
});
program
  .command('health')
  .description('Check database health only')
  .action(async () => {
    const cli = new ReplicaTestCLI();
    const result = await cli.testDatabaseHealth();
    console.log(result); 
  });

program
  .command('high-load')
  .description('Check High Concurrent Load')
  .action(async () => {
    const cli = new ReplicaTestCLI();
    const result = await cli.testHighLoadConcurrent();
    console.log(result); 
  });
program
  .command('overload')
  .description('Run only the system overload test (demonstrates need for sharding)')
  .action(async () => {
    const cli = new ReplicaTestCLI();
    await cli.testSystemOverload();
  });

if (isMainThread) {
  program.parse();
} else {
  console.log('Worker thread started');
}

export default ReplicaTestCLI;
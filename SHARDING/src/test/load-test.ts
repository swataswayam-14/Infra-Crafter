import axios from 'axios';

interface LoadTestConfig {
  baseUrl: string;
  concurrency: number;
  duration: number; 
  writeRatio: number; // 0.0 to 1.0
}

interface TestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  throughput: number;
  errors: string[];
}

export class LoadTester {
  private config: LoadTestConfig;
  private results: TestResult;
  private startTime: number = 0;
  private requestCount: number = 0;
  private latencies: number[] = [];
  private errors: string[] = [];

  constructor(config: LoadTestConfig) {
    this.config = config;
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      throughput: 0,
      errors: []
    };
  }

  async runTest(): Promise<TestResult> {
    console.log('Starting load test...');
    console.log(`Config: ${this.config.concurrency} concurrent users, ${this.config.duration}s duration`);
    
    this.startTime = Date.now();
    
    const workers = Array.from({ length: this.config.concurrency }, () => this.worker());
    
    await new Promise(resolve => setTimeout(resolve, this.config.duration * 1000));
    
    await Promise.all(workers);
    
    this.calculateResults();
    
    console.log('Load test completed');
    this.printResults();
    
    return this.results;
  }

  private async worker(): Promise<void> {
    while (Date.now() - this.startTime < this.config.duration * 1000) {
      try {
        const isWrite = Math.random() < this.config.writeRatio;
        
        if (isWrite) {
          await this.performWrite();
        } else {
          await this.performRead();
        }
        
        this.results.successfulRequests++;
      } catch (error: any) {
            this.results.failedRequests++;

            let detailedError = 'Unknown error';

            if (error.response) {
                detailedError = `Status ${error.response.status} at ${error.config?.url || 'unknown URL'}: ${JSON.stringify(error.response.data)}`;
            } else if (error.request) {
                detailedError = `No response from ${error.config?.url || 'unknown URL'}`;
                } else if (error instanceof Error) {
            detailedError = `Error: ${error.message}`;
        }
        this.errors.push(detailedError);
    }
      this.requestCount++;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  private async performWrite(): Promise<void> {
    const startTime = Date.now();
    
    const shardKey = `user_${Math.floor(Math.random() * 10000)}`;
    const userData = {
      user_id: shardKey,
      name: `Test User ${this.requestCount}`,
      email: `test${this.requestCount}@example.com`,
      partition_key: 'A'
    };
    
    await axios.post(`${this.config.baseUrl}/api/write`, {
      table: 'users',
      data: userData
    }, {
      headers: {
        'x-shard-key': shardKey
      }
    });
    
    this.latencies.push(Date.now() - startTime);
  }

  private async performRead(): Promise<void> {
    const startTime = Date.now();
    
    const shardKey = `user_${Math.floor(Math.random() * 10000)}`;
    
    await axios.get(`${this.config.baseUrl}/api/read`, {
      params: {
        table: 'users',
        limit: 10
      },
      headers: {
        'x-shard-key': shardKey
      }
    });
    
    this.latencies.push(Date.now() - startTime);
  }

  private calculateResults(): void {
    this.results.totalRequests = this.results.successfulRequests + this.results.failedRequests;
    this.results.averageLatency = this.latencies.length > 0 
      ? this.latencies.reduce((sum, lat) => sum + lat, 0) / this.latencies.length 
      : 0;
    this.results.throughput = this.results.totalRequests / this.config.duration;
    this.results.errors = this.errors.slice(0, 10);
  }

  private printResults(): void {
    console.log('\nLoad Test Results:');
    console.log(`Total Requests: ${this.results.totalRequests}`);
    console.log(`Successful: ${this.results.successfulRequests}`);
    console.log(`Failed: ${this.results.failedRequests}`);
    console.log(`Average Latency: ${this.results.averageLatency.toFixed(2)}ms`);
    console.log(`Throughput: ${this.results.throughput.toFixed(2)} req/s`);
    console.log(`Success Rate: ${((this.results.successfulRequests / this.results.totalRequests) * 100).toFixed(2)}%`);
    
    if (this.results.errors.length > 0) {
      console.log('\nSample Errors:');
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
  }
}
if (require.main === module) {
  const config: LoadTestConfig = {
    baseUrl: 'http://localhost:3000',
    concurrency: 10,
    duration: 30,
    writeRatio: 0.7
  };
  
  const tester = new LoadTester(config);
  tester.runTest().catch(console.error);
}
interface Metric {
    timestamp: number;
    operation: string;
    shard: string;
    duration: number;
    success: boolean;
}

interface ErrorMetric {
    timestamp: number;
    operation: string;
    error: string;
    stack?: string;
}

export class AnalyticsService {
    private metrics: Metric[] = [];
    private errors: ErrorMetric[] = [];
    private readonly maxMetrics = 10000;

    private addMetric(operation: string, shard:string, duration: number, success: boolean): void {
        this.metrics.push({
            timestamp: Date.now(),
            operation,
            shard,
            duration,
            success
        });
    }

    recordWrite(shard: string, duration: number): void {
        this.addMetric('write', shard, duration, true)
    }
    recordRead(shard: string, duration: number): void {
        this.addMetric('read', shard, duration, true);
    }
    recordError(operation: string, error: Error): void {
        this.errors.push({
            timestamp: Date.now(),
            operation,
            error: error.message,
            stack: error.stack
        });
        if(this.errors.length > 1000) {
            this.errors = this.errors.slice(-1000);
        }
    }
    getMetrics(timeRange: number = 300000): any { //5 mins
        const cutoff = Date.now() - timeRange;
        const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff);
        const stats = {
            total: recentMetrics.length,
            writes: recentMetrics.filter(m => m.operation === 'write').length,
            reads: recentMetrics.filter(m => m.operation === 'read').length,
            errors: this.errors.filter(e => e.timestamp >= cutoff).length,
            avgLatency: 0,
            shardDistribution: {} as { [key: string]: number },
            throughput: 0
        }
        if(recentMetrics.length > 0) {
            stats.avgLatency = recentMetrics.reduce((sum, m ) => sum+= m.duration, 0)/recentMetrics.length;
            stats.throughput = recentMetrics.length / (timeRange/1000) //operations per second
            recentMetrics.forEach(m => {
                stats.shardDistribution[m.shard] = (stats.shardDistribution[m.shard] || 0) + 1;
            });
        }
        return stats;
    }
    getRecentErrors(count: number = 50) : ErrorMetric[] {
        return this.errors.slice(-count);
    }
}
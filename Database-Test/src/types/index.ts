export interface DatabaseConfig {
    type: 'postgresql' | 'redis' | 'dynamodb' | 'mongodb' | 'neo4j';
    connectionString?: string;
    options?: any
}

export interface PerformanceMetrics {
    operationType: string;
    latency: number;
    throughput: number;
    memoryUsage: number;
    cpuUsage: number;
    timestamp: Date;
}

export interface BenchmarkResult {
    database: string;
    useCase: string;
    metrics: PerformanceMetrics[];
    summary: {
        avgLatency: number;
        maxThroughput: number;
        totalOperations: number;
        errorRate: number;
    };
}


//data models

export interface User {
    id: string;
    email: string;
    firstname: string;
    lastname: string;
    createdAt: Date;
    lastLoginAt?: Date;
    isActive: boolean;
    preferences: Record<string, any>
}

export interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    category: string;
    tags: string[];
    inventory: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface Session {
    sessionId: string;
    userId: string;
    data: Record<string, any>;
    expiresAt: Date;
    createdAt: Date;
}

export interface SocialUser {
    id: string;
    username: string;
    email: string;
    bio?:string;
    followersCount: number;
    followingCount: number;
}

export interface RelationShip {
    fromUserId: string;
    toUserId: string;
    type: ' FOLLOWS' | 'BLOCKS' | 'FRIENDS';
    createdAt: Date;
}

export interface AnalyticsEvent {
    id: string;
    userId: string;
    eventType: string;
    properties: Record<string, any>;
    timestamp: Date;
    sessionId?: string;
}
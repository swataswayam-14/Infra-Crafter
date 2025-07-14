import { DatabaseConfig } from "../types";

export const databaseConfigs: Record<string, DatabaseConfig> = {
    'postgresql' : {
        type: 'postgresql',
        connectionString: 'postgresql://localhost:5432/testdb',
        options: {
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        }
    },
    'redis' : {
        type: 'redis',
        connectionString: 'redis://localhost:6379',
        options: {
            socket: {
                connectTimeout: 2000,
                lazyConnect: true,
            }
        }
    },
    'dynamodb' : {
        type: 'dynamodb',
        options : {
            region: 'us-east-1',
            endpoint: 'http://localhost:8000',
            accessKeyId: 'local',
            secretAccessKey: 'local'
        }
    },
    'mongodb' : {
        type: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        options: {
            maxPoolSize: 10,
            serverConnectionTimeoutMS: 2000,
            socketTimeoutMS: 45000
        }
    },
    'neo4j': {
        type: 'neo4j',
        connectionString: 'bolt://localhost:7687',
        options: {
            auth: {
                username: 'neo4j',
                password: 'password'
            }
        }
    }
}
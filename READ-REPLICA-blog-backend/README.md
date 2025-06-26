# Read Replica Database Service

A database service that implements read replica functionality with PostgreSQL, supporting both synchronous and asynchronous replication strategies for improved performance and scalability.

## 🚀 Features

- **Master-Slave Architecture**: Separate read and write operations across master and replica databases
- **Dual Replication Strategies**: 
  - **Synchronous**: Ensures strong consistency across all replicas
  - **Asynchronous**: Provides better performance with eventual consistency
- **Automatic Failover**: Falls back to master database if replica queries fail
- **Round-Robin Load Balancing**: Distributes read requests evenly across available replicas
- **Health Monitoring**: Built-in health checks for master and replica databases
- **Retry Logic**: Exponential backoff retry mechanism for failed replications
- **Transaction Support**: ACID-compliant transaction handling
- **Comprehensive Logging**: Detailed logging with Pino logger


## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/swataswayam-14/Infra-Crafter
cd READ-REPLICA-blog-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables by creating a `.env` file:
```env

# Master Database (Read/Write)
MASTER_DB_HOST=localhost
MASTER_DB_PORT=5432
MASTER_DB_NAME=blog_master
MASTER_DB_USER=postgres
MASTER_DB_PASSWORD=password

# Replica Database 1 (Read Only)
REPLICA1_DB_HOST=localhost
REPLICA1_DB_PORT=5433
REPLICA1_DB_NAME=blog_replica1
REPLICA1_DB_USER=postgres
REPLICA1_DB_PASSWORD=password

# Replica Database 2 (Read Only)
REPLICA2_DB_HOST=localhost
REPLICA2_DB_PORT=5434
REPLICA2_DB_NAME=blog_replica2
REPLICA2_DB_USER=postgres
REPLICA2_DB_PASSWORD=password

# Replication Configuration
REPLICATION_STRATEGY=async  # 'sync' or 'async'
SYNC_TIMEOUT=5000          # Timeout in milliseconds
MAX_RETRIES=3              # Maximum retry attempts

# JWT Configuration
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
```

4. Build the project:
```bash
npm run build
```

5. Initialize the database:
```bash
npm run db:init
```

6. Test the setup:
```bash
npm run db:test
```

## 🏗️ Architecture


### Data Flow

```
┌─────────────────┐    ┌─────────────────┐
│   Application   │    │  Read Replicas  │
│                 │    │                 │
│  ┌───────────┐  │    │  ┌───────────┐  │
│  │   Read    │──┼────┼──│ Replica 1 │  │
│  │ Requests  │  │    │  └───────────┘  │
│  └───────────┘  │    │                 │
│                 │    │  ┌───────────┐  │
│  ┌───────────┐  │    │  │ Replica 2 │  │
│  │   Write   │──┼─┐  │  └───────────┘  │
│  │ Requests  │  │ │  └─────────────────┘
│  └───────────┘  │ │
└─────────────────┘ │  ┌─────────────────┐
                    │  │  Master Database│
                    └──│                 │
                       │  ┌───────────┐  │
                       │  │  Master   │  │
                       │  │    DB     │  │
                       │  └───────────┘  │
                       └─────────────────┘
```

## ⚙️ Configuration Options

### Replication Strategies

#### Synchronous Replication
- **Pros**: Strong consistency, immediate data availability on all replicas
- **Cons**: Higher latency, potential blocking if replicas are slow
- **Use Case**: Financial systems, critical data operations

```env
REPLICATION_STRATEGY=sync
SYNC_TIMEOUT=5000
```

#### Asynchronous Replication
- **Pros**: Better performance, non-blocking writes
- **Cons**: Eventual consistency, potential data lag
- **Use Case**: Content management, social media, analytics

```env
REPLICATION_STRATEGY=async
MAX_RETRIES=3
```

## 🎯 Use Cases and Scenarios

### 1. **Blog/Content Management Systems**
- **Read Operations**: Article listings, search, comments display
- **Write Operations**: Publishing posts, user comments, likes
- **Benefits**: Handle high read traffic while maintaining write performance

### 2. **E-commerce Platforms**
- **Read Operations**: Product catalogs, inventory display, user reviews
- **Write Operations**: Order processing, inventory updates, user registrations
- **Benefits**: Scale product browsing independently from order processing

### 3. **Social Media Applications**
- **Read Operations**: Timeline feeds, user profiles, notifications
- **Write Operations**: Posts, likes, follows, messages
- **Benefits**: Support millions of users reading feeds while handling real-time interactions

### 4. **Analytics and Reporting Systems**
- **Read Operations**: Dashboard queries, report generation, data visualization
- **Write Operations**: Event logging, metric updates, user tracking
- **Benefits**: Offload heavy analytical queries from transactional database

### 5. **News and Media Websites**
- **Read Operations**: Article reading, search, category browsing
- **Write Operations**: Content publishing, user comments, subscriptions
- **Benefits**: Handle traffic spikes during breaking news while maintaining editorial workflow

### 6. **Financial Applications**
- **Read Operations**: Account balance display, transaction history, statements
- **Write Operations**: Money transfers, account updates, audit logs
- **Benefits**: Separate read-heavy customer operations from critical write operations

### 7. **Gaming Platforms**
- **Read Operations**: Leaderboards, game statistics, player profiles
- **Write Operations**: Score updates, achievement unlocks, game saves
- **Benefits**: Handle real-time game queries while ensuring data consistency for critical updates

### 8. **IoT and Monitoring Systems**
- **Read Operations**: Sensor data visualization, historical trends, alerts
- **Write Operations**: Sensor data ingestion, configuration updates
- **Benefits**: Scale data visualization independently from high-volume data ingestion


## 📊 Performance Considerations

### When to Use Read Replicas

1. **Read-Heavy Workloads**: Applications with 80/20 or 90/10 read/write ratios
2. **Geographic Distribution**: Serve users from geographically closer replicas
3. **Reporting and Analytics**: Offload complex queries from production database
4. **Disaster Recovery**: Maintain standby replicas for failover scenarios

### Performance Benefits

- **Horizontal Scaling**: Add more read replicas as traffic grows
- **Reduced Master Load**: Distribute read queries across multiple servers
- **Improved Response Times**: Serve reads from less loaded replica servers
- **Better Resource Utilization**: Optimize different servers for read vs write workloads

## 🚨 Error Handling

The service implements comprehensive error handling:

- **Replica Failures**: Automatic fallback to master for read operations
- **Replication Lag**: Configurable timeouts and retry mechanisms
- **Connection Issues**: Connection pooling and automatic reconnection
- **Transaction Failures**: Proper rollback and error propagation


## 🧪 Testing

Run the test suite to verify your setup:

```bash
npm run db:test
```

This will:
- Check database connectivity
- Test read operations on replicas
- Test write operations on master
- Verify transaction handling
- Validate replication strategies

---
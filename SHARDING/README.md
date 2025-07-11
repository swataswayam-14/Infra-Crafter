# Infra-Crafter: Sharded Database System

A complete TypeScript implementation of a horizontally scaled database system with sharding, replication, and load balancing.

## Architecture

### Sharding Strategy
- **Shard 1**: Partitions A (30MB) + B (20MB) = 50MB total
- **Shard 2**: Partition D (25MB) = 25MB total  
- **Shard 3**: Partitions C (15MB) + E (10MB) = 25MB total

### Components
- **API Router**: Central gateway for routing requests
- **Shard Manager**: Handles data distribution and replication
- **Analytics Service**: Monitors performance and system health
- **Load Balancer**: Distributes requests across shards

## Quick Start

### 1. Setup
```bash
# Install dependencies
npm install

# Build
npm run build

# Start databases
docker-compose up -d

# Setup database tables
npm run setup-db

# Generate test data
npm run generate-data
```

### 2. Start API Server
```bash
npm run dev
```

### 3. Run Load Tests
```bash
npm run load-test
```

# OR
### Run the setup script

- Make the setup script executable 

```bash
chmod +x setup.sh
```
- Run the setup script

```bash
./setup.sh
```

## API Endpoints

### Data Operations
- `POST /api/write` - Write data to appropriate shard
- `GET /api/read` - Read data from replica
- `POST /api/bulk-write` - Bulk insert operations

### Monitoring
- `GET /api/health` - System health check
- `GET /api/analytics/metrics` - Performance metrics
- `GET /api/analytics/errors` - Error logs

### Example Usage
```bash
# Write data
curl -X POST http://localhost:3000/api/write \
  -H "Content-Type: application/json" \
  -H "x-shard-key: user_123" \
  -d '{
    "table": "users",
    "data": {
      "user_id": "user_123",
      "name": "John Doe",
      "email": "john@example.com",
      "partition_key": "A"
    }
  }'

# Read data
curl "http://localhost:3000/api/read?table=users&limit=10" \
  -H "x-shard-key: user_123"
```

## 🔧 Configuration

### Database Connections
Modify `src/config/database.ts` to update connection settings.

### Sharding Rules
Update `src/config/sharding.ts` to modify partition distribution.

### Load Testing
Configure test parameters in `src/test/load-test.ts`.

## Monitoring

The system includes built-in analytics:
- Request latency tracking
- Throughput monitoring
- Error rate analysis
- Shard health checks

Access metrics at: `http://localhost:3000/api/analytics/metrics`

## Docker Services

- **PostgreSQL Shards**: 3 primary databases (ports 5432, 5434, 5436)
- **Read Replicas**: 3 replica databases (ports 5433, 5435, 5437)


### Partitioning Strategies
- **Horizontal**: Distribute rows based on user ID hash
- **Vertical**: Separate tables by access patterns
- **Hybrid**: Combine both strategies for optimal performance

## Key Features:

1. **Horizontal Scaling**: Data distributed across 3 shards
2. **Read Replicas**: Separate read/write operations
3. **Hash-based Routing**: Consistent shard selection
4. **Performance Monitoring**: Built-in analytics
5. **Load Testing**: Concurrent request simulation
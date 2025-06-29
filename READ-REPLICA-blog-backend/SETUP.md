# 🧪 CLI-Based Read Replica Testing

This project includes a powerful CLI utility to **test the health, replication strategy, read/write distribution, failover handling, and system overload detection** of your PostgreSQL read-replica setup.

## 📦 Prerequisites

Ensure you've completed setup using:

```bash
./setup.sh
```

This script will:
1. Install dependencies
2. Build the TypeScript code
3. Spin up Docker containers (PostgreSQL master and replicas)
4. Initialize all databases
5. Run the CLI test suite

## 🚀 Run All Tests

```bash
npm run db:test:complete
```

This will execute:
* ✅ Health check for master and replicas
* 📖 Read operations + round-robin load balancing
* ✍️ Write operations on master
* 🔁 Replication strategy validation
* ⚠️ Replica failover simulation
* 🔄 Transactional write validation
* 🧵 High load concurrent stress test
* 💥 System overload test to reveal scaling needs

## 🔍 Run Specific Tests

You can also run individual tests using these convenient npm scripts:

| Command | Description |
|---------|-------------|
| `npm run db:test:health` | ✅ Check DB connectivity for master & replicas |
| `npm run db:test:read` | 📖 Only test read ops and load balancing |
| `npm run db:test:write` | ✍️ Only test write ops |
| `npm run db:test:replication` | 🔁 Test your replication strategy |
| `npm run db:test:load` | 🧵 Simulate high concurrent traffic |
| `npm run db:test:overload` | 💥 Simulate system overload + advise sharding |

## 📊 Sample Output

```bash
🚀 READ REPLICA COMPREHENSIVE TEST SUITE 🚀

[INFO] Master DB: Healthy
[INFO] Replica 1: Healthy
[INFO] Replica 2: Healthy

✅ Read Operations & Load Balancing - 342ms
✅ Write Operations - 194ms
✅ Transactions - 87ms
✅ SYSTEM OVERLOAD TEST - 11482ms

🎉 READ replica testing completed! 🎉
```

## 💡 System Overload Test

The overload test simulates extreme query pressure. If your system starts to fail or exceed response time limits, it will **recommend horizontal sharding**.

```bash
npm run db:test:overload
```

Output:

```pgsql
🚨 SYSTEM OVERLOAD DETECTED! 🚨
💡 SOLUTION REQUIRED: TO SOLVE THIS WE NEED SHARDING!
```

## 🧠 Why This Matters

This CLI is built to **educate and validate** real-world system design strategies, including:
* Read vs. Write separation
* Load balancing using round-robin
* Failover resilience
* Scalability limits → sharding recommendation
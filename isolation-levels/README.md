# SQL Isolation Levels - A Practical Demo (TypeScript + PostgreSQL)

Welcome to the **Isolation Levels Demo** — a real-world, code-level breakdown of how different **transaction isolation levels** behave in relational databases.

This is a part of [Infra-Crafter](https://github.com/swataswayam-14/Infra-Crafter), a growing repository to **implement and demystify advanced system design concepts**

---

## What Are Isolation Levels?

When multiple users interact with a database concurrently, **isolation levels** determine how visible intermediate results are between transactions.

SQL defines 4 standard isolation levels:

| Level             | Dirty Read | Non-repeatable Read | Phantom Read  |
|-------------------|------------|---------------------|---------------|
| Read Uncommitted  | ✅         | ✅                   | ✅            |
| Read Committed    | ❌         | ✅                   | ✅            |
| Repeatable Read   | ❌         | ❌                   | ✅            |
| Serializable      | ❌         | ❌                   | ❌            |

> **PostgreSQL note**: PostgreSQL **treats Read Uncommitted as Read Committed**, so dirty reads are never allowed — we simulate it.

---

### 📌 Dirty Read

> A transaction reads **uncommitted data** from another transaction.

**Example:**

- Txn A inserts a row (e.g., `('bob', 1000)`) but doesn’t commit.
- Txn B reads that row.
- Then Txn A **rolls back**.
- Result: Txn B read data that never officially existed (a "dirty" read).

✅ Possible in **Read Uncommitted**  
❌ Prevented in **PostgreSQL**, even if you try to use Read Uncommitted.

---

### 📌 Non-Repeatable Read

> A transaction reads the **same row twice** and gets **different results**.

**Example:**

- Txn A reads Alice’s balance → `1000`.
- Txn B updates Alice’s balance to `900` and commits.
- Txn A reads again → sees `900`.

⚠️ Even though Txn A never updated anything, its view of the data **changed mid-transaction**.

✅ Possible in **Read Committed**  
❌ Prevented in **Repeatable Read** and **Serializable**

---

### 📌 Phantom Read

> A transaction re-runs a query and sees **new rows** ("phantoms") that didn’t exist the first time.

**Example:**

- Txn A runs: `SELECT * FROM orders WHERE amount > 1000` → gets 5 rows.
- Txn B inserts a new order for 1500 and commits.
- Txn A runs the same query again → now gets 6 rows.

✅ Possible in **Repeatable Read**  
❌ Prevented in **Serializable**

---